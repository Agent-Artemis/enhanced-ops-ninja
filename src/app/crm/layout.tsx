export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#111111' }}>
      {children}
    </div>
  );
}
