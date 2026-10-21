import { moveAntAlongTunnel, moveAntToward, moveAntSearching } from './antMovement.js';
import { createFoodSource, hasReachedFood, hasDetectedFood } from './foodMechanics.js';
import { createSoilGrains, renderFarm } from './farmRenderer.js';

const FORAGING = 'foraging';
const RETURNING = 'returning';
const SEARCHING = 'searching';
const WAITING = 'waiting';
const TUNNEL_POINT_SPACING = 4;

export class AntFarmSimulation {
    ants = [];
    nextAntId = 1;
    lastSpawnTime = 0;
    simulationTime = 0;
    maxAnts = 5;
    tunnel = [];
    tunnelEstablished = false;
    needsNewTunnel = false;
    scoutAntId = null;

    constructor(width, height, maxAnts = 5, foodAmount = 80) {
        this.width = width;
        this.height = height;
        this.maxAnts = maxAnts;
        this.nest = { x: width * 0.2, y: height * 0.72, radius: 20 };
        this.food = createFoodSource(width, height, this.nest, foodAmount);
        this.soilGrains = createSoilGrains(width, height);
        this.tunnel = [{ x: this.nest.x, y: this.nest.y }];
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

            if (ant.state === SEARCHING) {
                if (hasDetectedFood(ant, this.food)) {
                    moveAntToward(ant, this.food, stepDistance);
                } else {
                    moveAntSearching(ant, this.width, this.height, stepDistance);
                }

                this.recordTunnelPoint(ant);

                if (hasReachedFood(ant, this.food)) {
                    this.recordTunnelPoint(ant, true);
                    ant.state = RETURNING;
                    ant.routeIndex = this.tunnel.length - 2;
                    this.collectFood();
                }
            } else if (ant.state === FORAGING) {
                const reachedFood = moveAntAlongTunnel(ant, this.tunnel, stepDistance, 1);
                if (reachedFood && hasReachedFood(ant, this.food)) {
                    ant.state = RETURNING;
                    ant.routeIndex = this.tunnel.length - 2;
                    this.collectFood();
                }
            } else if (ant.state === RETURNING) {
                const reachedNest = this.tunnel.length > 1
                    ? moveAntAlongTunnel(ant, this.tunnel, stepDistance, -1)
                    : this.moveAntHome(ant, stepDistance);

                if (reachedNest) this.antReturned(ant);
            }
        });

        this.finishNewSearchIfReady();
    }

    render(ctx) {
        renderFarm(ctx, {
            width: this.width,
            height: this.height,
            nest: this.nest,
            food: this.food,
            ants: this.ants,
            tunnel: this.tunnel,
            tunnelEstablished: this.tunnelEstablished,
            soilGrains: this.soilGrains,
        });
    }

    createAnt() {
        const id = this.nextAntId++;
        const isScout = this.scoutAntId === null;
        if (isScout) this.scoutAntId = id;

        const directionToFood = Math.atan2(
            this.food.y - this.nest.y,
            this.food.x - this.nest.x
        );

        return {
            id,
            x: this.nest.x,
            y: this.nest.y,
            state: isScout ? SEARCHING : this.tunnelEstablished ? FORAGING : WAITING,
            speed: 0.42 + Math.random() * 0.18,
            heading: directionToFood,
            wanderAngle: 0,
            isScout,
            routeIndex: this.tunnelEstablished ? 1 : undefined,
        };
    }

    recordTunnelPoint(ant, force = false) {
        const lastPoint = this.tunnel[this.tunnel.length - 1];
        if (Math.hypot(ant.x - lastPoint.x, ant.y - lastPoint.y) >= TUNNEL_POINT_SPACING || force) {
            if (Math.hypot(ant.x - lastPoint.x, ant.y - lastPoint.y) > 0.5) {
                this.tunnel.push({ x: ant.x, y: ant.y });
            }
        }
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
                ant.routeIndex = Math.min(
                    Math.max((ant.routeIndex ?? 1) - 1, 0),
                    this.tunnel.length - 2
                );
            }
        });
    }

    moveAntHome(ant, distance) {
        moveAntToward(ant, this.nest, distance);
        return Math.hypot(ant.x - this.nest.x, ant.y - this.nest.y) < this.nest.radius;
    }

    antReturned(ant) {
        if (ant.isScout && !this.tunnelEstablished && !this.needsNewTunnel) {
            this.tunnelEstablished = true;
            this.ants.forEach((waitingAnt) => {
                if (waitingAnt.state === WAITING) {
                    waitingAnt.state = FORAGING;
                    waitingAnt.routeIndex = 1;
                }
            });
        }

        ant.state = this.tunnelEstablished ? FORAGING : WAITING;
        ant.routeIndex = this.tunnelEstablished ? 1 : undefined;
    }

    finishNewSearchIfReady() {
        if (!this.needsNewTunnel || this.ants.some((ant) => ant.state === RETURNING)) return;

        this.food = createFoodSource(this.width, this.height, this.nest, this.food.maxAmount, this.food);
        this.tunnel = [{ x: this.nest.x, y: this.nest.y }];
        this.tunnelEstablished = false;
        this.needsNewTunnel = false;

        this.ants.forEach((ant) => {
            ant.state = WAITING;
            ant.routeIndex = undefined;
        });

        const scout = this.ants.find((ant) => ant.id === this.scoutAntId) ?? this.ants[0];
        if (scout) {
            scout.state = SEARCHING;
            scout.heading = Math.atan2(this.food.y - scout.y, this.food.x - scout.x);
            scout.wanderAngle = 0;
        }
    }
}