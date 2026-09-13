// A template re-mounts on every navigation (unlike layout, which persists), so
// this wrapper's fade-in animation runs each time the user moves between pages.
export default function Template({ children }) {
  return <div className="page-fade">{children}</div>;
}
