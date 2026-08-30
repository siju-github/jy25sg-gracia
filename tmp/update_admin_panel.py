with open('src/components/AdminPanel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. State insertion
target_state = "const [selectedAuditLog, setSelectedAuditLog] = useState<RegistrationAuditLog | null>(null);"
replacement_state = target_state + "\n  const [selectedAuditLogIds, setSelectedAuditLogIds] = useState<string[]>([]);"
if target_state in content and "selectedAuditLogIds" not in content:
    content = content.replace(target_state, replacement_state)

# 2. Handlers insertion
target_handler = """  const handleDeleteAuditLog = async (logId: string) => {
    try {
      const success = await deleteAuditLogFromFirestore(logId);
      if (success) {
        setAuditLogs(prev => prev.filter(l => l.id !== logId));
      }
    } catch (e) {
      console.error('Delete audit log error:', e);
    }
  };"""

replacement_handler = """  const handleDeleteAuditLog = async (logId: string) => {
    if (!confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) return;
    try {
      const logObj = auditLogs.find(l => l.id === logId);
      const success = await deleteAuditLogFromFirestore(logId, logObj);
      if (success) {
        setAuditLogs(prev => prev.filter(l => l.id !== logId));
        setSelectedAuditLogIds(prev => prev.filter(id => id !== logId));
        setAdminNotification({
          type: 'success',
          message: 'Deleted registration record permanently removed from database.'
        });
      }
    } catch (e) {
      console.error('Delete audit log error:', e);
    }
  };

  const handleBulkDeleteAuditLogs = async () => {
    if (selectedAuditLogIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedAuditLogIds.length} selected record(s)? This action cannot be undone.`)) return;

    setIsSaving(true);
    try {
      let deletedCount = 0;
      for (const logId of selectedAuditLogIds) {
        const logObj = auditLogs.find(l => l.id === logId);
        const success = await deleteAuditLogFromFirestore(logId, logObj);
        if (success) deletedCount++;
      }
      setAuditLogs(prev => prev.filter(l => !selectedAuditLogIds.includes(l.id || '')));
      setSelectedAuditLogIds([]);
      setAdminNotification({
        type: 'success',
        message: `Successfully permanently deleted ${deletedCount} selected record(s) from deleted registrations table.`
      });
    } catch (err: any) {
      console.error('Bulk delete audit logs error:', err);
      setAdminNotification({
        type: 'error',
        message: err.message || 'Failed to delete selected records.'
      });
    } finally {
      setIsSaving(false);
    }
  };"""

if target_handler in content:
    content = content.replace(target_handler, replacement_handler)

# 3. Controls Bar Bulk Delete Button
target_controls = """                  <select
                    value={auditActionFilter || 'all'}
                    onChange={(e: any) => setAuditActionFilter(e.target.value)}
                    className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2242A6]"
                  >
                    <option value="all">All Actions (Edits & Deletions)</option>
                    <option value="delete">Deletions Only</option>
                    <option value="edit">Edits Only</option>
                  </select>
                </div>
              </div>"""

replacement_controls = """                  <select
                    value={auditActionFilter || 'all'}
                    onChange={(e: any) => setAuditActionFilter(e.target.value)}
                    className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2242A6]"
                  >
                    <option value="all">All Actions (Edits & Deletions)</option>
                    <option value="delete">Deletions Only</option>
                    <option value="edit">Edits Only</option>
                  </select>
                </div>

                {selectedAuditLogIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDeleteAuditLogs}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Permanently ({selectedAuditLogIds.length})</span>
                  </button>
                )}
              </div>"""

if target_controls in content:
    content = content.replace(target_controls, replacement_controls)

# 4. Table header checkbox
target_thead = """                    <thead className="bg-white/10 text-white font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-4">Timestamp</th>"""

replacement_thead = """                    <thead className="bg-white/10 text-white font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={
                              auditLogs.filter(log => {
                                if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
                                if (auditSearchQuery.trim()) {
                                  const q = auditSearchQuery.toLowerCase();
                                  const nameMatch = log.registrantName?.toLowerCase().includes(q);
                                  const emailMatch = log.registrantEmail?.toLowerCase().includes(q);
                                  const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
                                  return nameMatch || emailMatch || adminMatch;
                                }
                                return true;
                              }).length > 0 &&
                              auditLogs.filter(log => {
                                if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
                                if (auditSearchQuery.trim()) {
                                  const q = auditSearchQuery.toLowerCase();
                                  const nameMatch = log.registrantName?.toLowerCase().includes(q);
                                  const emailMatch = log.registrantEmail?.toLowerCase().includes(q);
                                  const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
                                  return nameMatch || emailMatch || adminMatch;
                                }
                                return true;
                              }).every(l => l.id && selectedAuditLogIds.includes(l.id))
                            }
                            onChange={(e) => {
                              const visible = auditLogs.filter(log => {
                                if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
                                if (auditSearchQuery.trim()) {
                                  const q = auditSearchQuery.toLowerCase();
                                  const nameMatch = log.registrantName?.toLowerCase().includes(q);
                                  const emailMatch = log.registrantEmail?.toLowerCase().includes(q);
                                  const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
                                  return nameMatch || emailMatch || adminMatch;
                                }
                                return true;
                              });
                              if (e.target.checked) {
                                setSelectedAuditLogIds(visible.map(l => l.id).filter(Boolean) as string[]);
                              } else {
                                setSelectedAuditLogIds([]);
                              }
                            }}
                            className="w-4 h-4 rounded bg-black/40 border-amber-500/40 text-amber-500 focus:ring-amber-400 cursor-pointer"
                            title="Select All"
                          />
                        </th>
                        <th className="p-4">Timestamp</th>"""

if target_thead in content:
    content = content.replace(target_thead, replacement_thead)

# 5. Empty table colSpan
content = content.replace('<td colSpan={9} className="p-8 text-center text-white/50 italic">', '<td colSpan={10} className="p-8 text-center text-white/50 italic">')

# 6. Table row checkbox
target_row = """                          .map((log) => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                              <td className="p-4 text-white/60 text-[11px] whitespace-nowrap">"""

replacement_row = """                          .map((log) => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                              <td className="p-4 text-center whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={log.id ? selectedAuditLogIds.includes(log.id) : false}
                                  onChange={(e) => {
                                    if (!log.id) return;
                                    if (e.target.checked) {
                                      setSelectedAuditLogIds(prev => [...prev, log.id!]);
                                    } else {
                                      setSelectedAuditLogIds(prev => prev.filter(id => id !== log.id));
                                    }
                                  }}
                                  className="w-4 h-4 rounded bg-black/40 border-amber-500/40 text-amber-500 focus:ring-amber-400 cursor-pointer"
                                />
                              </td>
                              <td className="p-4 text-white/60 text-[11px] whitespace-nowrap">"""

if target_row in content:
    content = content.replace(target_row, replacement_row)

with open('src/components/AdminPanel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated AdminPanel.tsx successfully!')
