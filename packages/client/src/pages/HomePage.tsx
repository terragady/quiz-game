import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main className="screen screen--center">
      <div className="card home">
        <h1 className="home__title">Quiz Party</h1>
        <p className="home__subtitle">
          A real-time party quiz for a big screen and everyone&apos;s phones.
        </p>
        <nav className="home__links">
          <Link className="btn btn--primary" to="/host">
            Host on the TV
          </Link>
          <Link className="btn" to="/play">
            Join as a player
          </Link>
        </nav>
      </div>
    </main>
  );
}
