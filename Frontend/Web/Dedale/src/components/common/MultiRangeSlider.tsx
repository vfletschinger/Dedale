import { useCallback, useEffect, useState, useRef } from "react";

interface MultiRangeSliderProps {
    min: number;
    max: number;
    onChange: (min: number, max: number) => void;
}

const MultiRangeSlider = ({ min, max, onChange }: MultiRangeSliderProps) => {
    const [minVal, setMinVal] = useState(min);
    const [maxVal, setMaxVal] = useState(max);
    const minValRef = useRef(min);
    const maxValRef = useRef(max);
    const range = useRef<HTMLDivElement>(null);

    // Ref pour le conteneur principal afin de calculer la position du clic
    const sliderRef = useRef<HTMLDivElement>(null);

    // Synchronisation props -> state
    useEffect(() => {
        setMinVal(min);
        minValRef.current = min;
        setMaxVal(max);
        maxValRef.current = max;
    }, [min, max]);

    const getPercent = useCallback(
        (value: number) => Math.round(((value - 0) / (10 - 0)) * 100),
        []
    );

    // Mise à jour CSS des barres
    useEffect(() => {
        const minPercent = getPercent(minVal);
        const maxPercent = getPercent(maxValRef.current);

        if (range.current) {
            range.current.style.left = `${minPercent}%`;
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [minVal, getPercent]);

    useEffect(() => {
        const minPercent = getPercent(minValRef.current);
        const maxPercent = getPercent(maxVal);

        if (range.current) {
            range.current.style.width = `${maxPercent - minPercent}%`;
        }
    }, [maxVal, getPercent]);

    useEffect(() => {
        onChange(minVal, maxVal);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [minVal, maxVal]);

    // --- NOUVELLE FONCTION : GESTION DU CLIC SUR LA BARRE ---
    const handleTrackClick = (e: React.MouseEvent) => {
        if (!sliderRef.current) return;

        // 1. Calculer où on a cliqué en pourcentage (0 à 1)
        const rect = sliderRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const percent = clickX / width;

        // 2. Convertir en valeur (ex: cliquer à 50% donne 10)
        const rawValue = 0 + (10 - 0) * percent; // min + (max - min) * percent
        const value = Math.round(Math.max(0, Math.min(10, rawValue))); // Clamp entre 0 et 10

        // 3. Trouver qui est le plus proche : le bouton Min ou Max ?
        const distMin = Math.abs(value - minVal);
        const distMax = Math.abs(value - maxVal);

        if (distMin < distMax) {
            // Plus proche du MIN -> On déplace le MIN
            // Attention : Min ne peut pas dépasser Max - 1
            const newVal = Math.min(value, maxVal - 1);
            setMinVal(newVal);
            minValRef.current = newVal;
        } else {
            // Plus proche du MAX -> On déplace le MAX
            // Attention : Max ne peut pas dépasser Min + 1
            const newVal = Math.max(value, minVal + 1);
            setMaxVal(newVal);
            maxValRef.current = newVal;
        }
    };

    return (
        // AJOUT DE : ref={sliderRef}, onClick={handleTrackClick} et cursor-pointer
        <div
            ref={sliderRef}
            onClick={handleTrackClick}
            className="relative w-full h-5 cursor-pointer group" // cursor-pointer indique qu'on peut cliquer
        >

            {/* INPUTS (Inchangés) */}
            <input
                type="range"
                min={0}
                max={10}
                value={minVal}
                onChange={(event) => {
                    const value = Math.min(Number(event.target.value), maxVal - 1);
                    setMinVal(value);
                    minValRef.current = value;
                }}
                className="thumb pointer-events-none absolute h-0 w-full outline-none z-3 top-1/2 -translate-y-1/2 left-0"
                style={{ zIndex: minVal > 10 - 5 ? "5" : "3" }}
            />

            <input
                type="range"
                min={0}
                max={10}
                value={maxVal}
                onChange={(event) => {
                    const value = Math.max(Number(event.target.value), minVal + 1);
                    setMaxVal(value);
                    maxValRef.current = value;
                }}
                className="thumb pointer-events-none absolute h-0 w-full outline-none z-4 top-1/2 -translate-y-1/2 left-0"
            />

            {/* BARRES VISUELLES (Inchangées) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-18px)] h-1.5 z-1 pointer-events-none">
                <div className="absolute top-0 left-0 h-full w-full rounded bg-gray-200"></div>
                <div ref={range} className="absolute top-0 h-full rounded bg-blue-500 z-2"></div>
            </div>
        </div>
    );
};

export default MultiRangeSlider;