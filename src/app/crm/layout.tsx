import './print.css';
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#111111' }}>
      {/* Stamped by the Print button; visible on paper only. Lets a
          photographed page be identified after the fact. */}
      <div id="crmPrintHeader" />
      {children}
    </div>
  );
}
