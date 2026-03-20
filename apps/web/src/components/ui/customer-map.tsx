"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Navigation } from "lucide-react";

// Fix for default marker icon in leaflet with webpack/nextjs
const customIcon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Helper component to recenter map when coords change
function RecenterAutomatically({ lat, lng }: { lat: number, lng: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng]);
    }, [lat, lng, map]);
    return null;
}

interface CustomerMapProps {
    latitude: number;
    longitude: number;
    customerName: string;
    className?: string;
}

export default function CustomerMap({ latitude, longitude, customerName, className = "h-64" }: CustomerMapProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleNavigate = () => {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
        window.open(url, '_blank');
    };

    if (!mounted) {
        return <div className={`w-full bg-[var(--bg-secondary)] animate-pulse rounded-[var(--radius-lg)] ${className}`} />;
    }

    return (
        <div className={`relative w-full rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] shadow-[var(--shadow-card)] group ${className}`}>
            <MapContainer
                center={[latitude, longitude]}
                zoom={16}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%', zIndex: 0 }}
                attributionControl={false}
            >
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                <Marker position={[latitude, longitude]} icon={customIcon}>
                    <Popup className="font-sans">
                        <b>{customerName}</b><br />
                        Accurate GPS Location
                    </Popup>
                </Marker>
                <RecenterAutomatically lat={latitude} lng={longitude} />
            </MapContainer>

            {/* Floating Action Button for Navigation */}
            <button
                onClick={handleNavigate}
                className="absolute bottom-4 right-4 z-[400] bg-[var(--gold)] text-[var(--bg-primary)] hover:bg-[var(--gold-light)] px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 font-bold text-sm transition-transform hover:scale-105"
            >
                <Navigation size={16} />
                Navigate
            </button>
        </div>
    );
}
