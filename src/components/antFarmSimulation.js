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
const ATTACKING = 'attacking';
const TUNNEL_POINT_SPACING = 4;
const TUNNEL_LIFETIME_MS = 60_000;
const TUNNEL_CLEANUP_INTERVAL_MS = 5_000;
const ENEMY_SPAWN_DELAY_MIN_MS = 5_000;
const ENEMY_SPAWN_DELAY_RANGE_MS = 5_000;
const ENEMY_ATTACKER_MIN_COUNT = 2;
const ENEMY_ATTACKER_COUNT_RANGE = 4;

export class AntFarmSimulation {
    ants = [];
    enemyAnts = [];
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
    enemyNest = null;
    enemySpawnTime = null;
    enemySpawned = false;
    hasSpawnedFriendlyAnt = false;

    constructor(width, height, maxAnts = 5, foodAmount = 80) {
        this.width = width;
        this.height = height;
        this.maxAnts = maxAnts;
        this.reset(foodAmount);
    }

    reset(foodAmount = this.food?.maxAmount ?? 80) {
        this.ants = [];
        this.enemyAnts = [];
        this.nextAntId = 1;
        this.lastSpawnTime = 0;
        this.simulationTime = 0;
        this.nest = { x: this.width * 0.2, y: this.height * 0.72, radius: 20 };
        this.food = createFoodSource(this.width, this.height, this.nest, foodAmount);
        this.soilGrains = createSoilGrains(this.width, this.height);
        this.scoutPath = [{ x: this.nest.x, y: this.nest.y }];
        this.tunnelNetwork = new TunnelNetwork();
        this.tunnelNetwork.getOrCreateNode(this.nest);
        this.tunnelEstablished = false;
        this.needsNewTunnel = false;
        this.scoutAntId = null;
        this.nextTunnelCleanupTime = 0;
        this.attackedEnemies = new WeakSet();
        this.enemyNest = null;
        this.enemySpawnTime = null;
        this.enemySpawned = false;
        this.hasSpawnedFriendlyAnt = false;
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

    resetIfNoWorkers() {
        const hasActiveWorker = this.ants.some((ant) =>
            ant.isAlive
            && (ant.type === ANT_TYPES.SCOUT || ant.type === ANT_TYPES.FORAGER)
            && (ant.state === SEARCHING || ant.state === FORAGING || ant.state === RETURNING));
        if (!this.hasSpawnedFriendlyAnt || hasActiveWorker) return false;

        this.reset(this.food.maxAmount);
        return true;
    }

    update(speedMultiplier = 1) {
        if (this.resetIfNoWorkers()) return;

        this.simulationTime += 1000 / 60;

        if (this.ants.length < this.maxAnts && this.simulationTime - this.lastSpawnTime > 250) {
            this.ants.push(this.createAnt());
            this.hasSpawnedFriendlyAnt = true;
            this.lastSpawnTime = this.simulationTime;
        }

        this.ants.forEach((ant) => {
            const stepDistance = ant.speed * speedMultiplier;

            if (ant.type === ANT_TYPES.DEFENDER) {
                if (ant.targetEnemy) {
                    this.updateDefender(ant, stepDistance);
                } else if (ant.state === RETURNING) {
                    this.updateReturningAnt(ant, stepDistance);
                } else {
                    ant.state = WAITING;
                    ant.route = null;
                    ant.routeIndex = undefined;
                }
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
                this.updateReturningAnt(ant, stepDistance);
            }
        });

        this.finishNewSearchIfReady();

        if (!this.enemySpawned && this.enemySpawnTime !== null && this.simulationTime >= this.enemySpawnTime) {
            this.spawnEnemyColony();
        }

        this.enemyAnts.forEach((ant) => this.updateEnemy(ant, ant.speed * speedMultiplier));
        this.ants = this.ants.filter((ant) => ant.isAlive);
        this.enemyAnts = this.enemyAnts.filter((ant) => ant.isAlive);

        if (this.enemySpawned && this.enemyAnts.length === 0) {
            this.enemyNest = null;
            this.enemySpawned = false;
            this.enemySpawnTime = this.simulationTime
                + ENEMY_SPAWN_DELAY_MIN_MS
                + Math.random() * ENEMY_SPAWN_DELAY_RANGE_MS;
        }

        if (this.resetIfNoWorkers()) return;

        if (this.simulationTime >= this.nextTunnelCleanupTime) {
            this.tunnelNetwork.pruneExpired(this.simulationTime, TUNNEL_LIFETIME_MS, [...this.ants, ...this.enemyAnts]);
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
            enemyAnts: this.enemyAnts,
            enemyNest: this.enemyNest,
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
        if (this.ants.length >= this.maxAnts) return null;

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
            this.moveAntTowardTargetAlongTunnel(defender, enemy, stepDistance);
        }
    }

    updateReturningAnt(ant, stepDistance) {
        if (!ant.route) this.planTunnelRoute(ant, this.nest);

        const reachedNest = ant.route
            ? moveAntAlongTunnel(ant, ant.route, stepDistance, ant.routeDirection ?? 1)
            : this.moveAntHome(ant, stepDistance);

        if (reachedNest) this.antReturned(ant);
    }

    findEnemyNestPosition() {
        const marginX = Math.min(50, this.width * 0.1);
        const marginY = Math.min(60, this.height * 0.1);
        const minimumNestDistance = Math.min(this.width, this.height) * 0.4;

        for (let attempt = 0; attempt < 100; attempt += 1) {
            const candidatePosition = {
                x: marginX + Math.random() * (this.width - marginX * 2),
                y: marginY + Math.random() * (this.height - marginY * 2),
            };
            const isFarFromFriendlyNest = Math.hypot(candidatePosition.x - this.nest.x, candidatePosition.y - this.nest.y) >= minimumNestDistance;
            const isFarFromFood = Math.hypot(candidatePosition.x - this.food.x, candidatePosition.y - this.food.y) >= 70;

            if (isFarFromFriendlyNest && isFarFromFood) return candidatePosition;
        }

        return {
            x: this.nest.x < this.width / 2 ? this.width - marginX : marginX,
            y: this.nest.y < this.height / 2 ? this.height - marginY : marginY,
        };
    }

    spawnEnemyColony() {
        this.enemySpawned = true;
        this.enemySpawnTime = null;
        this.enemyNest = { ...this.findEnemyNestPosition(), radius: 16 };
        this.connectToNearestTunnel(this.enemyNest);

        const attackerCount = ENEMY_ATTACKER_MIN_COUNT + Math.floor(Math.random() * ENEMY_ATTACKER_COUNT_RANGE);
        for (let index = 0; index < attackerCount; index += 1) {
            this.enemyAnts.push(new Ant({
                id: this.nextAntId++,
                x: this.enemyNest.x,
                y: this.enemyNest.y,
                type: ANT_TYPES.ENEMY,
                state: ATTACKING,
                speed: 0.36 + Math.random() * 0.12,
                heading: Math.random() * Math.PI * 2,
            }));
        }
    }

    connectToNearestTunnel(ant) {
        const nearestTunnelId = this.tunnelNetwork.connectNearest(ant);
        const nearestTunnel = this.tunnelNetwork.nodes.get(nearestTunnelId);
        if (!nearestTunnel) return null;

        const distanceToTunnel = Math.hypot(nearestTunnel.x - ant.x, nearestTunnel.y - ant.y);
        if (distanceToTunnel > 2) {
            const connection = this.tunnelNetwork.addPath([
                { x: ant.x, y: ant.y },
                nearestTunnel,
            ], this.simulationTime);
            return connection?.startId ?? nearestTunnelId;
        }

        return nearestTunnelId;
    }

    findNearestFriendlyAnt(enemy) {
        return this.ants
            .filter((ant) => ant.isAlive)
            .reduce((nearest, ant) => {
                if (!nearest) return ant;
                const antDistance = Math.hypot(ant.x - enemy.x, ant.y - enemy.y);
                const nearestDistance = Math.hypot(nearest.x - enemy.x, nearest.y - enemy.y);
                return antDistance < nearestDistance ? ant : nearest;
            }, null);
    }

    planTunnelPursuitRoute(ant, target) {
        const startId = this.connectToNearestTunnel(ant);
        const targetId = this.tunnelNetwork.connectNearest(target);
        const route = this.tunnelNetwork.findRoute(startId, targetId);

        if (!route || route.length < 2) {
            ant.route = null;
            ant.routeIndex = undefined;
            ant.isPursuingTarget = true;
            return;
        }

        if (Math.hypot(route[0].x - ant.x, route[0].y - ant.y) > 0.5) {
            route.unshift({ x: ant.x, y: ant.y });
        }

        ant.route = route;
        ant.routeIndex = route.length > 1 ? 1 : 0;
        ant.routeDirection = 1;
        ant.isPursuingTarget = false;
    }

    moveAntTowardTargetAlongTunnel(ant, target, stepDistance) {
        if (!ant.route && !ant.isPursuingTarget) {
            this.planTunnelPursuitRoute(ant, target);
        }

        if (!ant.route) {
            moveAntToward(ant, target, stepDistance);
            return;
        }

        const reachedRouteEnd = moveAntAlongTunnel(ant, ant.route, stepDistance, ant.routeDirection ?? 1);
        if (reachedRouteEnd) {
            ant.route = null;
            ant.isPursuingTarget = true;
        }
    }

    updateEnemy(enemy, stepDistance) {
        if (!enemy.targetAnt || !enemy.targetAnt.isAlive) {
            enemy.targetAnt = this.findNearestFriendlyAnt(enemy);
            enemy.route = null;
            enemy.routeIndex = undefined;
            enemy.isPursuingTarget = false;
        }

        const target = enemy.targetAnt;
        if (!target) return;

        const distanceToTarget = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (distanceToTarget <= enemy.attackRange) {
            if (enemy.attackEnemy(target, this.simulationTime)) {
                this.onForagerAttacked(target, enemy);
            }
            return;
        }

        this.moveAntTowardTargetAlongTunnel(enemy, target, stepDistance);
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
            if (ant.type !== ANT_TYPES.DEFENDER && (ant.state === FORAGING || ant.state === SEARCHING)) {
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
        if (ant.hasFood && this.enemySpawnTime === null && !this.enemySpawned) {
            this.enemySpawnTime = this.simulationTime
                + ENEMY_SPAWN_DELAY_MIN_MS
                + Math.random() * ENEMY_SPAWN_DELAY_RANGE_MS;
        }
        ant.hasFood = false;

        if (ant.isScout && !this.tunnelEstablished && !this.needsNewTunnel) {
            this.tunnelEstablished = true;
            this.ants.forEach((waitingAnt) => {
                if (waitingAnt.type !== ANT_TYPES.DEFENDER && waitingAnt.state === WAITING) {
                    waitingAnt.state = FORAGING;
                    waitingAnt.route = null;
                    waitingAnt.routeIndex = undefined;
                }
            });
        }

        ant.state = ant.type === ANT_TYPES.DEFENDER || !this.tunnelEstablished ? WAITING : FORAGING;
        if (ant.type === ANT_TYPES.DEFENDER) {
            ant.targetEnemy = null;
            ant.isAlive = false;
        }
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
            if (ant.type === ANT_TYPES.DEFENDER) {
                if (!ant.targetEnemy) ant.state = WAITING;
                return;
            }
            ant.state = WAITING;
            ant.route = null;
            ant.routeIndex = undefined;
        });

        let scout = this.ants.find((ant) => ant.id === this.scoutAntId && ant.type !== ANT_TYPES.DEFENDER)
            ?? this.ants.find((ant) => ant.type !== ANT_TYPES.DEFENDER);

        if (!scout) {
            scout = this.createAnt(ANT_TYPES.SCOUT);
            this.ants.push(scout);
            this.hasSpawnedFriendlyAnt = true;
        }

        scout.isScout = true;
        this.scoutAntId = scout.id;
        scout.state = SEARCHING;
        scout.heading = Math.random() * Math.PI * 2;
        scout.wanderAngle = 0;
    }
}