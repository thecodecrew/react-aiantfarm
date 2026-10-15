import React, { useEffect, useRef, useState } from 'react';
import { AntFarmSimulation } from './antFarmSimulation.js';
import { AntFarmSettingsPanel } from './AntFarmSettingsPanel';

const FARM_SIZE = { width: 960, height: 600 };
const MAX_DISPLAY_WIDTH = 1200;

const getCanvasDisplaySize = (settingsOpen: boolean) => {
    const settingsWidth = Math.min(settingsOpen ? 294 : 114, Math.max(0, window.innerWidth - 36));
    const availableWidth = Math.max(0, Math.min(MAX_DISPLAY_WIDTH, window.innerWidth - 24 - settingsWidth - 12));
    const availableHeight = Math.max(0, window.innerHeight - 100);
    const width = Math.min(availableWidth, availableHeight * FARM_SIZE.width / FARM_SIZE.height);

    return { width, height: width * FARM_SIZE.height / FARM_SIZE.width };
};

export const Ants: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const simulationRef = useRef<AntFarmSimulation | null>(null);
    const [speedMultiplier, setSpeedMultiplier] = useState(3);
    const [maxAnts, setMaxAnts] = useState(5);
    const [foodAmount, setFoodAmount] = useState(80);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [canvasDisplaySize, setCanvasDisplaySize] = useState(() => getCanvasDisplaySize(false));
    const speedMultiplierRef = useRef(1);
    const maxAntsRef = useRef(5);
    const foodAmountRef = useRef(80);

    useEffect(() => {
        speedMultiplierRef.current = speedMultiplier;
    }, [speedMultiplier]);

    useEffect(() => {
        maxAntsRef.current = maxAnts;
        if (simulationRef.current) {
            simulationRef.current.setMaxAnts(maxAnts);
        }
    }, [maxAnts]);

    useEffect(() => {
        foodAmountRef.current = foodAmount;
        if (simulationRef.current) {
            simulationRef.current.setFoodAmount(foodAmount);
        }
    }, [foodAmount]);

    useEffect(() => {
        const updateCanvasDisplaySize = () => {
            setCanvasDisplaySize(getCanvasDisplaySize(settingsOpen));
        };

        updateCanvasDisplaySize();
        window.addEventListener('resize', updateCanvasDisplaySize);

        return () => {
            window.removeEventListener('resize', updateCanvasDisplaySize);
        };
    }, [settingsOpen]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(FARM_SIZE.width * ratio);
        canvas.height = Math.floor(FARM_SIZE.height * ratio);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(ratio, ratio);

        const simulation = new AntFarmSimulation(FARM_SIZE.width, FARM_SIZE.height, maxAntsRef.current, foodAmountRef.current);
        simulationRef.current = simulation;

        let animationId = 0;
        let previousFrameTime = 0;
        let simulationAccumulator = 0;
        const fixedStepDuration = 1000 / 60;
        const maxFrameDelta = 100;
        const maxStepsPerFrame = 20;

        const tick = (frameTime: number) => {
            const elapsed = previousFrameTime === 0 ? 0 : Math.min(frameTime - previousFrameTime, maxFrameDelta);
            previousFrameTime = frameTime;
            simulationAccumulator = Math.min(
                simulationAccumulator + elapsed,
                fixedStepDuration * maxStepsPerFrame,
            );

            simulation.setMaxAnts(maxAntsRef.current);
            let steps = 0;
            while (simulationAccumulator >= fixedStepDuration && steps < maxStepsPerFrame) {
                simulation.update(speedMultiplierRef.current);
                simulationAccumulator -= fixedStepDuration;
                steps += 1;
            }
            simulation.render(ctx);
            animationId = requestAnimationFrame(tick);
        };

        animationId = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, []);

    return (
        <div style={{ width: '100%', padding: '16px 12px 20px', boxSizing: 'border-box' }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', boxSizing: 'border-box' }}>
                <div style={{ width: `${canvasDisplaySize.width}px`, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ color: '#fff', fontFamily: 'sans-serif', margin: 0, textAlign: 'center' }}>AI Ant Farm Simulation</h2>
                    <canvas
                        ref={canvasRef}
                        style={{
                            border: '6px solid #60452f',
                            borderRadius: '10px',
                            boxShadow: '0 0 0 2px #a0825b, 0 10px 24px rgba(0,0,0,0.45)',
                            width: `${canvasDisplaySize.width}px`,
                            maxWidth: '100%',
                            height: `${canvasDisplaySize.height}px`,
                            boxSizing: 'border-box',
                        }}
                    />
                </div>
                <AntFarmSettingsPanel
                    speedMultiplier={speedMultiplier}
                    maxAnts={maxAnts}
                    foodAmount={foodAmount}
                    onSpeedChange={setSpeedMultiplier}
                    onMaxAntsChange={setMaxAnts}
                    onFoodAmountChange={setFoodAmount}
                    isOpen={settingsOpen}
                    onToggle={() => setSettingsOpen((open) => !open)}
                />
            </div>
        </div>
    );
};

export default Ants;
