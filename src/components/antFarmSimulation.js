import { moveAntToward } from './antMovement.js';
import { createFoodSource, hasReachedFood } from './foodMechanics.js';
import { createSoilGrains, renderFarm } from './farmRenderer.js';

const FORAGING = 'foraging';
const RETURNING = 'returning';

export class AntFarmSimulation {
    ants = [];
    nextAntId = 1;
    lastSpawnTime = 0;
    simulationTime = 0;
    maxAnts = 5;

    constructor(width, height, maxAnts = 5, foodAmount = 80) {
        this.width = width;
        this.height = height;
        this.maxAnts = maxAnts;
        this.nest = { x: width * 0.2, y: height * 0.72, radius: 20 };
        this.food = createFoodSource(width, height, this.nest, foodAmount);
        this.soilGrains = createSoilGrains(width, height);
    }

    setMaxAnts(value) {
        this.maxAnts = value;
    }

    setFoodAmount(value) {
        this.food.maxAmount = value;
        this.food.amount = Math.min(this.food.amount, value);
        if (this.food.amount <= 0) {
            this.food = createFoodSource(this.width, this.height, this.nest, value, this.food);
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
            const target = ant.state === FORAGING ? this.food : this.nest;
            moveAntToward(ant, target, ant.speed * speedMultiplier);

            if (ant.state === FORAGING && hasReachedFood(ant, this.food)) {
                this.food.amount = Math.max(0, this.food.amount - 1);
                ant.state = RETURNING;
                if (this.food.amount <= 0) {
                    this.food = createFoodSource(this.width, this.height, this.nest, this.food.maxAmount, this.food);
                }
            } else if (ant.state === RETURNING && Math.hypot(ant.x - this.nest.x, ant.y - this.nest.y) < this.nest.radius) {
                ant.state = FORAGING;
            }
        });
    }

    render(ctx) {
        renderFarm(ctx, {
            width: this.width,
            height: this.height,
            nest: this.nest,
            food: this.food,
            ants: this.ants,
            soilGrains: this.soilGrains,
        });
    }

    createAnt() {
    const directionToFood = Math.atan2(
        this.food.y - this.nest.y,
        this.food.x - this.nest.x
    );

        return {
            id: this.nextAntId++,
            x: this.nest.x,
            y: this.nest.y,
            state: FORAGING,
            speed: 0.42 + Math.random() * 0.18,
            heading: directionToFood,
            wanderAngle: 0,
        };
    }
}