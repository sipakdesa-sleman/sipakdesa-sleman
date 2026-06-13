export default function DetailMatrix({ scores }) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th>Kriteria</th>
            <th>Skor</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(scores).map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td>
              <td className="text-center">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
