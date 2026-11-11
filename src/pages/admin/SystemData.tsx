import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Upload, ShieldCheck, Database, Wrench, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MasterExportModal } from '@/components/admin/MasterExportModal';
import { MasterImportModal } from '@/components/admin/MasterImportModal';
import { BranchTabs } from '@/components/admin/layout/BranchTabs';
import { ADMIN_NAV } from '@/components/admin/layout/adminNav';

export default function SystemData() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const hub = ADMIN_NAV.find((h) => h.key === 'system')!;

  return (
    <div className="space-y-4">
      <BranchTabs leaves={hub.leaves} />

      {/* Backup and Restore */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Master Backup &amp; Restore</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Full offline backup or restore of Shops, Mess &amp; Bhojanalay, PG &amp; Hostels, Categories, Listing Requests, Claims, and uploaded WebP images.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setShowExport(true)}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-sm flex items-center gap-2 active:scale-95"
          >
            <Download className="w-4 h-4" /> Export Complete Backup (ZIP / CSV)
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted transition flex items-center gap-2 active:scale-95"
          >
            <Upload className="w-4 h-4" /> Restore from Bundle
          </button>
        </div>
      </div>

      {/* Storage and Health shortcut */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-foreground">Database Quality &amp; Storage Health</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Audit orphaned images in Supabase storage, detect missing phone numbers, and scan unverified listings.
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/system/quality')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-muted/40 hover:bg-muted text-xs font-semibold text-foreground transition-all shrink-0"
        >
          <span>Open Health Tools</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <MasterExportModal open={showExport} onClose={() => setShowExport(false)} />
      {showImport && (
        <MasterImportModal
          onClose={() => setShowImport(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ['admin-shops'] });
            qc.invalidateQueries({ queryKey: ['admin-categories'] });
            qc.invalidateQueries({ queryKey: ['admin-stats'] });
            qc.invalidateQueries({ queryKey: ['living-messes'] });
            qc.invalidateQueries({ queryKey: ['living-pgs'] });
          }}
        />
      )}
    </div>
  );
}
