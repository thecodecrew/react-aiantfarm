const INTERSECTION_EPSILON = 1e-7;
const NODE_MERGE_DISTANCE = 1;

const cross = (first, second) => first.x * second.y - first.y * second.x;

const getSegmentIntersection = (start, end, edgeStart, edgeEnd) => {
    const pathDirection = { x: end.x - start.x, y: end.y - start.y };
    const edgeDirection = { x: edgeEnd.x - edgeStart.x, y: edgeEnd.y - edgeStart.y };
    const offset = { x: edgeStart.x - start.x, y: edgeStart.y - start.y };
    const denominator = cross(pathDirection, edgeDirection);

    if (Math.abs(denominator) < INTERSECTION_EPSILON) return null;

    const pathPosition = cross(offset, edgeDirection) / denominator;
    const edgePosition = cross(offset, pathDirection) / denominator;
    const isOnPath = pathPosition >= -INTERSECTION_EPSILON && pathPosition <= 1 + INTERSECTION_EPSILON;
    const isOnEdge = edgePosition >= -INTERSECTION_EPSILON && edgePosition <= 1 + INTERSECTION_EPSILON;

    if (!isOnPath || !isOnEdge) return null;

    return {
        pathPosition: Math.max(0, Math.min(1, pathPosition)),
        edgePosition: Math.max(0, Math.min(1, edgePosition)),
        point: {
            x: start.x + pathDirection.x * pathPosition,
            y: start.y + pathDirection.y * pathPosition,
        },
    };
};

const getDistance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);

export class TunnelNetwork {
    nodes = new Map();
    nextNodeId = 1;

    getOrCreateNode(point) {
        for (const node of this.nodes.values()) {
            if (getDistance(node, point) <= NODE_MERGE_DISTANCE) return node.id;
        }

        const id = this.nextNodeId++;
        this.nodes.set(id, { id, x: point.x, y: point.y, links: new Map() });
        return id;
    }

    connectNodes(firstId, secondId) {
        if (firstId === secondId) return;

        const first = this.nodes.get(firstId);
        const second = this.nodes.get(secondId);
        const distance = getDistance(first, second);
        first.links.set(secondId, distance);
        second.links.set(firstId, distance);
    }

    getEdges() {
        const edges = [];
        for (const node of this.nodes.values()) {
            for (const neighborId of node.links.keys()) {
                if (node.id < neighborId) edges.push({ startId: node.id, endId: neighborId });
            }
        }
        return edges;
    }

    splitEdge(startId, endId, junctionId) {
        if (junctionId === startId || junctionId === endId) return;

        const start = this.nodes.get(startId);
        const end = this.nodes.get(endId);
        start.links.delete(endId);
        end.links.delete(startId);
        this.connectNodes(startId, junctionId);
        this.connectNodes(junctionId, endId);
    }

    addPath(points) {
        if (points.length < 2) return null;

        const startId = this.getOrCreateNode(points[0]);
        let currentId = startId;

        points.slice(1).forEach((point) => {
            const start = this.nodes.get(currentId);
            const endId = this.getOrCreateNode(point);
            const end = this.nodes.get(endId);
            if (endId === currentId) return;

            const cuts = [
                { position: 0, nodeId: currentId },
                { position: 1, nodeId: endId },
            ];

            this.getEdges().forEach(({ startId: edgeStartId, endId: edgeEndId }) => {
                const edgeStart = this.nodes.get(edgeStartId);
                const edgeEnd = this.nodes.get(edgeEndId);
                const intersection = getSegmentIntersection(start, end, edgeStart, edgeEnd);
                if (!intersection) return;

                let junctionId;
                if (intersection.edgePosition <= INTERSECTION_EPSILON) {
                    junctionId = edgeStartId;
                } else if (intersection.edgePosition >= 1 - INTERSECTION_EPSILON) {
                    junctionId = edgeEndId;
                } else {
                    junctionId = this.getOrCreateNode(intersection.point);
                    this.splitEdge(edgeStartId, edgeEndId, junctionId);
                }

                cuts.push({ position: intersection.pathPosition, nodeId: junctionId });
            });

            cuts.sort((first, second) => first.position - second.position);
            const orderedNodeIds = [];
            cuts.forEach(({ nodeId }) => {
                if (orderedNodeIds[orderedNodeIds.length - 1] !== nodeId) orderedNodeIds.push(nodeId);
            });

            for (let index = 1; index < orderedNodeIds.length; index += 1) {
                this.connectNodes(orderedNodeIds[index - 1], orderedNodeIds[index]);
            }

            currentId = endId;
        });

        return { startId, endId: currentId };
    }

    connectNearest(point) {
        const edges = this.getEdges();
        if (edges.length === 0) {
            let nearestId = null;
            let nearestDistance = Infinity;
            for (const node of this.nodes.values()) {
                const distance = getDistance(node, point);
                if (distance < nearestDistance) {
                    nearestId = node.id;
                    nearestDistance = distance;
                }
            }
            return nearestId ?? this.getOrCreateNode(point);
        }

        let nearest = null;
        edges.forEach(({ startId, endId }) => {
            const start = this.nodes.get(startId);
            const end = this.nodes.get(endId);
            const deltaX = end.x - start.x;
            const deltaY = end.y - start.y;
            const lengthSquared = deltaX * deltaX + deltaY * deltaY;
            const position = lengthSquared === 0
                ? 0
                : Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared));
            const projection = { x: start.x + position * deltaX, y: start.y + position * deltaY };
            const distance = getDistance(point, projection);

            if (!nearest || distance < nearest.distance) {
                nearest = { startId, endId, position, projection, distance };
            }
        });

        if (nearest.position <= INTERSECTION_EPSILON) return nearest.startId;
        if (nearest.position >= 1 - INTERSECTION_EPSILON) return nearest.endId;

        const junctionId = this.getOrCreateNode(nearest.projection);
        this.splitEdge(nearest.startId, nearest.endId, junctionId);
        return junctionId;
    }

    findRoute(startId, endId) {
        if (!this.nodes.has(startId) || !this.nodes.has(endId)) return null;

        const distances = new Map([...this.nodes.keys()].map((id) => [id, Infinity]));
        const previous = new Map();
        const unvisited = new Set(this.nodes.keys());
        distances.set(startId, 0);

        while (unvisited.size > 0) {
            let currentId = null;
            let shortestDistance = Infinity;
            for (const id of unvisited) {
                if (distances.get(id) < shortestDistance) {
                    currentId = id;
                    shortestDistance = distances.get(id);
                }
            }

            if (currentId === null || currentId === endId) break;
            unvisited.delete(currentId);

            for (const [neighborId, edgeDistance] of this.nodes.get(currentId).links) {
                const candidateDistance = shortestDistance + edgeDistance;
                if (candidateDistance < distances.get(neighborId)) {
                    distances.set(neighborId, candidateDistance);
                    previous.set(neighborId, currentId);
                }
            }
        }

        if (startId !== endId && !previous.has(endId)) return null;

        const route = [];
        let currentId = endId;
        while (currentId !== undefined) {
            route.push(this.nodes.get(currentId));
            if (currentId === startId) break;
            currentId = previous.get(currentId);
        }

        if (route[route.length - 1]?.id !== startId) return null;
        return route.reverse().map(({ x, y, id }) => ({ id, x, y }));
    }

    getSegments() {
        return this.getEdges().map(({ startId, endId }) => ({
            start: this.nodes.get(startId),
            end: this.nodes.get(endId),
        }));
    }
}