import React from 'react';

interface AntFarmSettingsPanelProps {
    speedMultiplier: number;
    maxAnts: number;
    foodAmount: number;
    onSpeedChange: (value: number) => void;
    onMaxAntsChange: (value: number) => void;
    onFoodAmountChange: (value: number) => void;
    isOpen: boolean;
    onToggle: () => void;
}

export const AntFarmSettingsPanel: React.FC<AntFarmSettingsPanelProps> = ({
    speedMultiplier,
    maxAnts,
    foodAmount,
    onSpeedChange,
    onMaxAntsChange,
    onFoodAmountChange,
    isOpen,
    onToggle,
}) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row-reverse',
                alignItems: 'flex-start',
                maxWidth: 'calc(100vw - 36px)',
                minWidth: 0,
                zIndex: 10,
            }}
        >
            <button
                type="button"
                onClick={onToggle}
                aria-label={isOpen ? 'Close settings' : 'Open settings'}
                aria-expanded={isOpen}
                aria-controls="ant-farm-settings-controls"
                style={{
                    background: '#18231d',
                    color: '#e7e3d6',
                    border: '1px solid #59634c',
                    borderRadius: isOpen ? '0 8px 8px 0' : '8px',
                    padding: '0.7rem 0.8rem',
                    width: '104px',
                    minHeight: '44px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                }}
            >
                <span aria-hidden="true" style={{ fontSize: '0.95rem', lineHeight: 1 }}>⚙︎</span>
                <span>Settings</span>
            </button>

            <div
                id="ant-farm-settings-controls"
                style={{
                    width: '180px',
                    background: 'rgba(15, 23, 42, 0.96)',
                    border: '1px solid #59634c',
                    borderRadius: '8px 0 0 8px',
                    padding: '1rem 0.8rem',
                    display: isOpen ? 'flex' : 'none',
                    flexDirection: 'column',
                    gap: '1rem',
                    backdropFilter: 'blur(8px)',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label htmlFor="speed-slider" style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '0.8rem' }}>
                        Speed: {speedMultiplier.toFixed(1)}x
                    </label>
                    <input
                        id="speed-slider"
                        type="range"
                        min={1}
                        max={10}
                        step={0.1}
                        value={speedMultiplier}
                        onChange={(event) => onSpeedChange(Number(event.target.value))}
                        style={{ accentColor: '#3b82f6', width: '100%' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label htmlFor="ant-count-slider" style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '0.8rem' }}>
                        Ants: {maxAnts}
                    </label>
                    <input
                        id="ant-count-slider"
                        type="range"
                        min={1}
                        max={50}
                        step={1}
                        value={maxAnts}
                        onChange={(event) => onMaxAntsChange(Number(event.target.value))}
                        style={{ accentColor: '#22c55e', width: '100%' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label htmlFor="food-amount-slider" style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '0.8rem' }}>
                        Food / source: {foodAmount}
                    </label>
                    <input
                        id="food-amount-slider"
                        type="range"
                        min={20}
                        max={300}
                        step={10}
                        value={foodAmount}
                        onChange={(event) => onFoodAmountChange(Number(event.target.value))}
                        style={{ accentColor: '#f59e0b', width: '100%' }}
                    />
                </div>

            </div>
        </div>
    );
};

interface AntFarmSidebarProps {
    speedMultiplier: number;
    maxAnts: number;
    onSpeedChange: (value: number) => void;
    onMaxAntsChange: (value: number) => void;
}

export const AntFarmSidebar: React.FC<AntFarmSidebarProps> = ({
    speedMultiplier,
    maxAnts,
    onSpeedChange,
    onMaxAntsChange,
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', minWidth: '150px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="sidebar-speed-slider" style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
                    Speed: {speedMultiplier.toFixed(1)}x
                </label>
                <input
                    id="sidebar-speed-slider"
                    type="range"
                    min={1}
                    max={10}
                    step={0.1}
                    value={speedMultiplier}
                    onChange={(event) => onSpeedChange(Number(event.target.value))}
                    style={{ accentColor: '#3b82f6', width: '120px' }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="sidebar-ant-count-slider" style={{ color: '#fff', fontFamily: 'sans-serif', fontSize: '0.9rem' }}>
                    Ants: {maxAnts}
                </label>
                <input
                    id="sidebar-ant-count-slider"
                    type="range"
                    min={1}
                    max={1000}
                    step={1}
                    value={maxAnts}
                    onChange={(event) => onMaxAntsChange(Number(event.target.value))}
                    style={{ accentColor: '#22c55e', width: '120px' }}
                />
            </div>
        </div>
    );
};

export default AntFarmSettingsPanel;
