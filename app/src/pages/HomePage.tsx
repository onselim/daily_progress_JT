import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="panel-shell">
      <h1>Linear Infrastructure Progress Reporting</h1>
      <p>
        Project reports live at their own link, e.g. <code>/jvari-tskaltubo</code>.
      </p>
      <p>
        <Link to="/login">Admin / Field engineer sign in</Link>
      </p>
    </div>
  );
}
