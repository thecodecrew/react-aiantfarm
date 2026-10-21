const FOOD_RADIUS = 6;
const FOOD_PICKUP_RADIUS = 2;
const FOOD_SCENT_RADIUS = 60;

export const createFoodSource = (width, height, nest, maxAmount = 80, nearby) => {
    const minDistanceFromNest = nest.radius + 100;
    let x = 0;
    let y = 0;

    for (let attempt = 0; attempt < 100; attempt += 1) {
        if (nearby) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 35 + Math.random() * 55;
            x = Math.max(60, Math.min(width - 60, nearby.x + Math.cos(angle) * distance));
            y = Math.max(60, Math.min(height - 60, nearby.y + Math.sin(angle) * distance));
        } else {
            x = 60 + Math.random() * (width - 120);
            y = 60 + Math.random() * (height - 120);
        }

        if (Math.hypot(x - nest.x, y - nest.y) >= minDistanceFromNest) break;
    }

    return {
        x,
        y,
        radius: FOOD_RADIUS,
        pickupRadius: FOOD_PICKUP_RADIUS,
        scentRadius: FOOD_SCENT_RADIUS,
        amount: maxAmount,
        maxAmount,
    };
};

export const hasReachedFood = (ant, food) =>
    food.amount > 0 && Math.hypot(ant.x - food.x, ant.y - food.y) < food.pickupRadius;

export const hasDetectedFood = (ant, food) =>
    food.amount > 0 && Math.hypot(ant.x - food.x, ant.y - food.y) < food.scentRadius;