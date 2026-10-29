import { moveAntAlongTunnel, moveAntToward, moveAntSearching } from './antMovement.js';
import { createFoodSource, hasReachedFood, hasDetectedFood } from './foodMechanics.js';
import { createSoilGrains, renderFarm } from './farmRenderer.js';
import { TunnelNetwork } from './tunneling.js';
import { Ant, ANT_TYPES } from './ant.js';

const FORAGING = 'foraging';
const RETURNING = 'returning';
const SEARCHING = 'searching';
const WAITING = 'waiting';
const DEFENDING = 'defending';
const TUNNEL_POINT_SPACING = 4;
const TUNNEL_LIFETIME_MS = 60_000;
const TUNNEL_CLEANUP_INTERVAL_MS = 5_000;

export class AntFarmSimulation {
    ants = [];
    nextAntId = 1;
    lastSpawnTime = 0;
    simulationTime = 0;
    maxAnts = 5;
    tunnelNetwork = new TunnelNetwork();
    scoutPath = [];
    tunnelEstablished = false;
    needsNewTunnel = false;
    scoutAntId = null;
    nextTunnelCleanupTime = 0;
    attackedEnemies = new WeakSet();

    constructor(width, height, maxAnts = 5, foodAmount = 80) {
        this.width = width;
        this.height = height;
        this.maxAnts = maxAnts;
        this.nest = { x: width * 0.2, y: height * 0.72, radius: 20 };
        this.food = createFoodSource(width, height, this.nest, foodAmount);
        this.soilGrains = createSoilGrains(width, height);
        this.scoutPath = [{ x: this.nest.x, y: this.nest.y }];
        this.tunnelNetwork.getOrCreateNode(this.nest);
    }

    setMaxAnts(value) {
        this.maxAnts = value;
    }

    setFoodAmount(value) {
        this.food.maxAmount = value;
        this.food.amount = Math.min(this.food.amount, value);
        if (this.food.amount <= 0) {
            this.needsNewTunnel = true;
            this.sendForagersHome();
        }
    }

    getAntCount() {
        return this.ants.length;
    }

    update(speedMultiplier = 1) {
        this.simulationTime += 1000 / 60;

        if (this.ants.length < this.maxAnts && this.simulationTime - this.lastSpawnTime > 250) {
            this.ants.push(this.createAnt());
            this.lastSpawnTime = this.simulationTime;
        }

        this.ants.forEach((ant) => {
            const stepDistance = ant.speed * speedMultiplier;

            if (ant.type === ANT_TYPES.DEFENDER && ant.targetEnemy) {
                this.updateDefender(ant, stepDistance);
            } else if (ant.state === SEARCHING) {
                if (hasDetectedFood(ant, this.food)) {
                    moveAntToward(ant, this.food, stepDistance);
                } else {
                    moveAntSearching(ant, this.width, this.height, stepDistance);
                }

                this.recordTunnelPoint(ant);

                if (hasReachedFood(ant, this.food)) {
                    this.recordTunnelPoint(ant, true);
                    ant.state = RETURNING;
                    ant.hasFood = true;
                    const path = this.tunnelNetwork.addPath(this.scoutPath, this.simulationTime);
                    this.planTunnelRoute(ant, this.nest, path.endId);
                    this.collectFood();
                }
            } else if (ant.state === FORAGING) {
                if (!ant.route) this.planTunnelRoute(ant, this.food);

                const reachedFood = ant.route
                    ? moveAntAlongTunnel(ant, ant.route, stepDistance, 1)
                    : false;
                if (reachedFood) ant.route = null;

                if (!ant.route && !hasReachedFood(ant, this.food)) {
                    moveAntToward(ant, this.food, stepDistance);
                }

                if (reachedFood && hasReachedFood(ant, this.food)) {
                    ant.state = RETURNING;
                    ant.hasFood = true;
                    ant.route = null;
                    this.collectFood();
                }
            } else if (ant.state === RETURNING) {
                if (!ant.route) {
                    this.planTunnelRoute(ant, this.nest);
                }

                const reachedNest = ant.route
                    ? moveAntAlongTunnel(ant, ant.route, stepDistance, ant.routeDirection ?? 1)
                    : this.moveAntHome(ant, stepDistance);

                if (reachedNest) this.antReturned(ant);
            }
        });

        this.finishNewSearchIfReady();

        if (this.simulationTime >= this.nextTunnelCleanupTime) {
            this.tunnelNetwork.pruneExpired(this.simulationTime, TUNNEL_LIFETIME_MS, this.ants);
            this.nextTunnelCleanupTime = this.simulationTime + TUNNEL_CLEANUP_INTERVAL_MS;
        }
    }

    render(ctx) {
        renderFarm(ctx, {
            width: this.width,
            height: this.height,
            nest: this.nest,
            food: this.food,
            ants: this.ants,
            tunnelSegments: this.tunnelNetwork.getSegments(),
            scoutPath: this.tunnelEstablished || this.needsNewTunnel ? [] : this.scoutPath,
            tunnelEstablished: this.tunnelEstablished,
            soilGrains: this.soilGrains,
        });
    }

    createAnt(type = null) {
        const id = this.nextAntId++;
        const isScout = type ? type === ANT_TYPES.SCOUT : this.scoutAntId === null;
        const antType = type ?? (isScout ? ANT_TYPES.SCOUT : ANT_TYPES.FORAGER);
        if (isScout) this.scoutAntId = id;

        return new Ant({
            id,
            x: this.nest.x,
            y: this.nest.y,
            type: antType,
            state: antType === ANT_TYPES.DEFENDER
                ? DEFENDING
                : isScout ? SEARCHING : this.tunnelEstablished ? FORAGING : WAITING,
            speed: 0.42 + Math.random() * 0.18,
            heading: Math.random() * Math.PI * 2,
            isScout,
        });
    }

    onForagerAttacked(forager, enemy) {
        if (forager.type !== ANT_TYPES.FORAGER || !enemy || typeof enemy !== 'object') return null;
        if (this.attackedEnemies.has(enemy)) return null;

        this.attackedEnemies.add(enemy);
        const defender = this.createAnt(ANT_TYPES.DEFENDER);
        defender.targetEnemy = enemy;
        this.ants.push(defender);
        return defender;
    }

    updateDefender(defender, stepDistance) {
        const enemy = defender.targetEnemy;
        if (enemy.isAlive === false || enemy.health <= 0) {
            defender.targetEnemy = null;
            defender.state = RETURNING;
            defender.route = null;
            return;
        }

        const distanceToEnemy = Math.hypot(enemy.x - defender.x, enemy.y - defender.y);
        if (distanceToEnemy <= defender.attackRange) {
            defender.attackEnemy(enemy, this.simulationTime);
        } else {
            moveAntToward(defender, enemy, stepDistance);
        }
    }

    recordTunnelPoint(ant, force = false) {
        const lastPoint = this.scoutPath[this.scoutPath.length - 1];
        if (Math.hypot(ant.x - lastPoint.x, ant.y - lastPoint.y) >= TUNNEL_POINT_SPACING || force) {
            if (Math.hypot(ant.x - lastPoint.x, ant.y - lastPoint.y) > 0.5) {
                this.scoutPath.push({ x: ant.x, y: ant.y });
            }
        }
    }

    planTunnelRoute(ant, destination, startNodeId = null) {
        const startId = startNodeId ?? this.tunnelNetwork.connectNearest({ x: ant.x, y: ant.y });
        const destinationId = this.tunnelNetwork.connectNearest(destination);
        const route = this.tunnelNetwork.findRoute(startId, destinationId);

        if (!route) {
            this.tunnelNetwork.addPath([{ x: ant.x, y: ant.y }, destination], this.simulationTime);
            ant.route = [{ x: ant.x, y: ant.y }, { x: destination.x, y: destination.y }];
            ant.routeIndex = 1;
            ant.routeDirection = 1;
            return;
        }

        if (Math.hypot(route[0].x - ant.x, route[0].y - ant.y) > 0.5) {
            route.unshift({ x: ant.x, y: ant.y });
        }

        const lastWaypoint = route[route.length - 1];
        if (Math.hypot(lastWaypoint.x - destination.x, lastWaypoint.y - destination.y) > 0.5) {
            this.tunnelNetwork.addPath([lastWaypoint, destination], this.simulationTime);
            route.push({ x: destination.x, y: destination.y });
        }

        ant.route = route;
        ant.routeIndex = route.length > 1 ? 1 : 0;
        ant.routeDirection = 1;
    }

    collectFood() {
        this.food.amount = Math.max(0, this.food.amount - 1);
        if (this.food.amount <= 0) {
            this.needsNewTunnel = true;
            this.tunnelEstablished = false;
            this.sendForagersHome();
        }
    }

    sendForagersHome() {
        this.ants.forEach((ant) => {
            if (ant.state === FORAGING || ant.state === SEARCHING) {
                ant.state = RETURNING;
                ant.route = null;
                ant.routeIndex = undefined;
                ant.routeDirection = 1;
            }
        });
    }

    moveAntHome(ant, distance) {
        moveAntToward(ant, this.nest, distance);
        return Math.hypot(ant.x - this.nest.x, ant.y - this.nest.y) < this.nest.radius;
    }

    antReturned(ant) {
        ant.hasFood = false;

        if (ant.isScout && !this.tunnelEstablished && !this.needsNewTunnel) {
            this.tunnelEstablished = true;
            this.ants.forEach((waitingAnt) => {
                if (waitingAnt.state === WAITING) {
                    waitingAnt.state = FORAGING;
                    waitingAnt.route = null;
                    waitingAnt.routeIndex = undefined;
                }
            });
        }

        ant.state = ant.type === ANT_TYPES.DEFENDER || !this.tunnelEstablished ? WAITING : FORAGING;
        ant.route = null;
        ant.routeIndex = undefined;
        ant.routeDirection = 1;
    }

    finishNewSearchIfReady() {
        if (!this.needsNewTunnel || this.ants.some((ant) => ant.state === RETURNING)) return;

        this.food = createFoodSource(this.width, this.height, this.nest, this.food.maxAmount, this.food);
        this.scoutPath = [{ x: this.nest.x, y: this.nest.y }];
        this.tunnelEstablished = false;
        this.needsNewTunnel = false;

        this.ants.forEach((ant) => {
            ant.state = WAITING;
            ant.route = null;
            ant.routeIndex = undefined;
        });

        const scout = this.ants.find((ant) => ant.id === this.scoutAntId) ?? this.ants[0];
        if (scout) {
            scout.state = SEARCHING;
            scout.heading = Math.random() * Math.PI * 2;
            scout.wanderAngle = 0;
        }
    }
}