/**
 * The Markov chain simulator's tab. Not built yet: this only holds its place, so the
 * tab exists and says what the tool is for. What the simulator takes as input and
 * how it works is still to be decided.
 */
export function MarkovPanel() {
  return (
    <div className="markov">
      <div className="stats-head">
        <div>
          <h2>Markov-simulator</h2>
          <p className="stats-sub">För att testa olika scenarier inför marknadsföringsbeslut</p>
        </div>
        <span className="soon">Kommer snart</span>
      </div>

      <div className="card markov-card">
        <h3>Inte byggd än</h3>
        <p>Här ska en simulator baserad på Markov-kedjor byggas. Den ska användas för att testa olika scenarier när marknadsföringsbeslut ska fattas. Tills den finns är fliken en reserverad plats.</p>
      </div>
    </div>
  );
}
