'use client';

import { useState, useRef, useEffect } from 'react';
import { Location } from '@/types';

interface LocationSearchProps {
    placeholder?: string;
    onLocationSelect: (location: Location) => void;
    value?: Location | null;
}

export default function LocationSearch({
    placeholder = 'Search for a location...',
    onLocationSelect,
    value,
}: LocationSearchProps) {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

    useEffect(() => {
        // Initialize Google Places Autocomplete
        if (inputRef.current && typeof window !== 'undefined' && window.google) {
            // Clean up existing autocomplete instance if it exists
            if (autocompleteRef.current) {
                window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
            }

            autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                // No types restriction - searches all place types including addresses and businesses
                fields: ['geometry', 'formatted_address', 'name'],
            });

            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current?.getPlace();
                if (place && place.geometry && place.geometry.location) {
                    // Use business name if available, otherwise use formatted address
                    const displayName = place.name || place.formatted_address || '';

                    const location: Location = {
                        lat: place.geometry.location.lat(),
                        lng: place.geometry.location.lng(),
                        address: displayName,
                    };
                    onLocationSelect(location);
                    setInputValue(displayName);
                    setShowSuggestions(false);
                }
            });
        }

        return () => {
            if (autocompleteRef.current) {
                window.google?.maps.event.clearInstanceListeners(autocompleteRef.current);
                autocompleteRef.current = null;
            }
        };
    }, [onLocationSelect]);

    // Update input value when external value changes
    useEffect(() => {
        if (value) {
            setInputValue(value.address);
        } else {
            setInputValue('');
        }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        setShowSuggestions(true);
    };

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setShowSuggestions(true);
        e.currentTarget.style.boxShadow = '0 0 0 2px #36399a';
    };

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        // Delay hiding suggestions to allow click on suggestion
        setTimeout(() => setShowSuggestions(false), 200);
        e.currentTarget.style.boxShadow = '';
    };

    return (
        <div className="relative w-full">
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                placeholder={placeholder}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-transparent text-black"
                style={{
                    '--tw-ring-color': '#36399a',
                } as React.CSSProperties & { '--tw-ring-color': string }}
            />
        </div>
    );
}

