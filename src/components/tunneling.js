const INTERSECTION_EPSILON = 1e-7;
const NODE_MERGE_DISTANCE = 1;

const cross = (first, second) => first.x * second.y - first.y * second.x;

class MinPriorityQueue {
    entries = [];

    push(nodeId, distance) {
        const entry = { nodeId, distance };
        this.entries.push(entry);
        let index = this.entries.length - 1;

        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.entries[parentIndex].distance <= distance) break;
            this.entries[index] = this.entries[parentIndex];
            index = parentIndex;
        }

        this.entries[index] = entry;
    }

    pop() {
        if (this.entries.length === 0) return null;

        const minimum = this.entries[0];
        const last = this.entries.pop();
        if (this.entries.length === 0) return minimum;

        let index = 0;
        while (true) {
            const leftIndex = index * 2 + 1;
            const rightIndex = leftIndex + 1;
            let smallestIndex = index;

            if (leftIndex < this.entries.length && this.entries[leftIndex].distance < this.entries[smallestIndex].distance) {
                smallestIndex = leftIndex;
            }
            if (rightIndex < this.entries.length && this.entries[rightIndex].distance < this.entries[smallestIndex].distance) {
                smallestIndex = rightIndex;
            }
            if (smallestIndex === index) break;

            this.entries[index] = this.entries[smallestIndex];
            index = smallestIndex;
        }

        this.entries[index] = last;
        return minimum;
    }
}

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

const getDistanceToSegment = (point, start, end) => {
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const position = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared));
    return getDistance(point, { x: start.x + position * deltaX, y: start.y + position * deltaY });
};

export class TunnelNetwork {
    nodes = new Map();
    nextNodeId = 1;
    rootNodeId = null;
    segmentCache = null;

    getOrCreateNode(point) {
        for (const node of this.nodes.values()) {
            if (getDistance(node, point) <= NODE_MERGE_DISTANCE) {
                this.rootNodeId ??= node.id;
                return node.id;
            }
        }

        const id = this.nextNodeId++;
        this.nodes.set(id, { id, x: point.x, y: point.y, links: new Map() });
        this.rootNodeId ??= id;
        return id;
    }

    connectNodes(firstId, secondId, createdAt = 0) {
        if (firstId === secondId) return;

        const first = this.nodes.get(firstId);
        const second = this.nodes.get(secondId);
        const distance = getDistance(first, second);
        const previousEdge = first.links.get(secondId);
        const edge = {
            distance,
            createdAt: Math.max(previousEdge?.createdAt ?? createdAt, createdAt),
        };
        first.links.set(secondId, edge);
        second.links.set(firstId, edge);
        this.segmentCache = null;
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
        const edge = start.links.get(endId);
        start.links.delete(endId);
        end.links.delete(startId);
        this.segmentCache = null;
        this.connectNodes(startId, junctionId, edge.createdAt);
        this.connectNodes(junctionId, endId, edge.createdAt);
    }

    addPath(points, createdAt = 0) {
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
                this.connectNodes(orderedNodeIds[index - 1], orderedNodeIds[index], createdAt);
            }

            currentId = endId;
        });

        return { startId, endId: currentId };
    }

    pruneExpired(currentTime, lifetime, ants = []) {
        let removedEdges = 0;
        const hasAntOnTunnel = this.getEdges().some(({ startId, endId }) => {
            const start = this.nodes.get(startId);
            const end = this.nodes.get(endId);
            return ants.some((ant) => ant.state !== 'waiting' && getDistanceToSegment(ant, start, end) <= 2);
        });

        if (hasAntOnTunnel) return 0;

        for (const node of this.nodes.values()) {
            for (const [neighborId, edge] of node.links) {
                if (node.id >= neighborId || currentTime - edge.createdAt < lifetime) continue;

                const neighbor = this.nodes.get(neighborId);
                node.links.delete(neighborId);
                neighbor?.links.delete(node.id);
                removedEdges += 1;
            }
        }

        if (removedEdges === 0) return 0;

        for (const [nodeId, node] of this.nodes) {
            if (nodeId !== this.rootNodeId && node.links.size === 0) this.nodes.delete(nodeId);
        }

        this.segmentCache = null;
        return removedEdges;
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
        const queue = new MinPriorityQueue();
        distances.set(startId, 0);
        queue.push(startId, 0);

        while (queue.entries.length > 0) {
            const current = queue.pop();
            if (current.distance !== distances.get(current.nodeId)) continue;
            if (current.nodeId === endId) break;

            for (const [neighborId, edge] of this.nodes.get(current.nodeId).links) {
                const candidateDistance = current.distance + edge.distance;
                if (candidateDistance < distances.get(neighborId)) {
                    distances.set(neighborId, candidateDistance);
                    previous.set(neighborId, current.nodeId);
                    queue.push(neighborId, candidateDistance);
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
        if (!this.segmentCache) {
            this.segmentCache = this.getEdges().map(({ startId, endId }) => ({
                start: this.nodes.get(startId),
                end: this.nodes.get(endId),
            }));
        }
        return this.segmentCache;
    }
}