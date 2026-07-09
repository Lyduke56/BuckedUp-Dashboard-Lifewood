import { Cloud, HardDrive } from "lucide-react";
import { Tilt } from "@/components/shared/Tilt";

export function StorageQuotaWidget() {
  const percentage = 78;

  return (
    <Tilt maxTilt={6} className="w-full h-full flex">
      <div className="panel panel-glass relative overflow-hidden p-6" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
        {/* Decorative background blob */}
        <div style={{
          position: 'absolute', top: '-24px', right: '-24px',
          width: '128px', height: '128px',
          background: 'radial-gradient(circle, rgba(255,159,28,0.12), transparent)',
          borderRadius: '50%', pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
          <Cloud size={18} color="var(--saffron)" />
          Cloud Storage
        </div>
        <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
          Monthly rendering pipeline quota.
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '4px' }}>
          <div style={{ fontSize: '30px', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>{percentage}%</div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-soft)' }}>1.56 TB / 2.00 TB</div>
        </div>

        {/* Progress Track */}
        <div style={{ width: '100%', height: '10px', background: 'var(--glass-bg)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
          <div style={{
            width: `${percentage}%`, height: '100%',
            background: 'linear-gradient(90deg, var(--saffron) 0%, #f59e0b 100%)',
            borderRadius: '6px',
            boxShadow: '0 0 8px rgba(255,159,28,0.4)'
          }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--ink-soft)' }}>
          <HardDrive size={13} color="var(--ink-soft)" />
          <span>Next automated backup in 4 hours</span>
        </div>
      </div>
    </Tilt>
  );
}

