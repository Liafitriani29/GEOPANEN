import {
  MapContainer,
  TileLayer,
  Polygon,
  Popup
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import { sawahData } from "../data/sawahData";

export default function SukoharjoMap() {
  return (
    <div className="relative">

      <MapContainer
        center={[-7.683, 110.83]}
        zoom={11}
        className="h-[500px] w-full rounded-3xl"
      >

        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {sawahData.map((sawah, index) => (
          <Polygon
            key={index}
            positions={sawah.coordinates}
            pathOptions={{
              color: sawah.color,
              fillColor: sawah.color,
              fillOpacity: 0.5
            }}
          >
            <Popup>
              <div>
                <h3 className="font-bold">
                  {sawah.nama}
                </h3>

                <p>
                  Prediksi:
                  {" "}
                  {sawah.prediksi} ton/ha
                </p>

                <p>
                  Status:
                  {" "}
                  {sawah.status}
                </p>
              </div>
            </Popup>
          </Polygon>
        ))}
      </MapContainer>

      {/* Legend */}

      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-xl shadow-lg z-[1000]">

        <h3 className="font-bold mb-2">
          Produktivitas
        </h3>

        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500"></div>
          <span>Tinggi</span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div className="w-4 h-4 bg-yellow-400"></div>
          <span>Sedang</span>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div className="w-4 h-4 bg-red-500"></div>
          <span>Rendah</span>
        </div>

      </div>

    </div>
  );
}