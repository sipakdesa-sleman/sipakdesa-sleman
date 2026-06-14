import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getResultDetail } from "../services/resultService";
import DetailMatrix from "../components/DetailMatrix";
import { PageSkeleton } from "../components/SkeletonLoader";

export default function DetailPeringkat() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    getResultDetail(id).then(setData);
  }, [id]);

  if (!data) {
    return (
      <div className="page-shell">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-header-container">
        <div className="page-header">
          <h1 className="page-title">Detail Perhitungan – {data.desa}</h1>
          <p className="page-subtitle">
            Visualisasi normalisasi matriks, perkalian bobot kriteria, dan akumulasi nilai optimasi Yi untuk Kalurahan {data.desa}. (Peringkat: <b>{data.rank}</b> | Yi: <b>{data.yi.toFixed(4)}</b>)
          </p>
        </div>
      </div>

      <DetailMatrix scores={data.scores} />
    </div>
  );
}
