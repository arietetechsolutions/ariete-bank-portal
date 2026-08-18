import { Link } from 'react-router-dom';

const NotFound = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
      <p className="text-muted-foreground mb-4">Page not found</p>
      <Link to="/" className="text-primary underline">Go home</Link>
    </div>
  </div>
);

export default NotFound;
