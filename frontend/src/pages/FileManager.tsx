import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, File, ChevronRight, ArrowLeft, Plus, Trash2,
  Save, Edit3, FolderPlus, RefreshCw, Loader2, X,
  FileText, Code, AlertTriangle, Check,
} from 'lucide-react';

interface FileManagerProps {
  projectId: string;
  appId: string;
}

const token = () => localStorage.getItem('deployflow_token');

const api = {
  list: (appId: string, p: string) =>
    fetch(`/api/files/${appId}?path=${encodeURIComponent(p)}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
  read: (appId: string, p: string) =>
    fetch(`/api/files/${appId}/read?path=${encodeURIComponent(p)}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
  write: (appId: string, p: string, content: string) =>
    fetch(`/api/files/${appId}/write`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ path: p, content }) }).then(r => r.json()),
  mkdir: (appId: string, p: string) =>
    fetch(`/api/files/${appId}/mkdir`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ path: p }) }).then(r => r.json()),
  delete: (appId: string, p: string) =>
    fetch(`/api/files/${appId}/delete?path=${encodeURIComponent(p)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
  rename: (appId: string, oldPath: string, newPath: string) =>
    fetch(`/api/files/${appId}/rename`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ oldPath, newPath }) }).then(r => r.json()),
};

function getFileIcon(name: string, type: string) {
  if (type === 'dir') return <Folder size={16} className="text-yellow-400" />;
  const ext = name.split('.').pop()?.toLowerCase();
  if (['js','ts','jsx','tsx','py','rb','go','java','cpp','c','php'].includes(ext||''))
    return <Code size={16} className="text-blue-400" />;
  if (['html','htm','css','scss'].includes(ext||''))
    return <FileText size={16} className="text-orange-400" />;
  if (['json','yaml','yml','toml','env'].includes(ext||''))
    return <FileText size={16} className="text-green-400" />;
  return <File size={16} className="text-gray-400" />;
}

function isEditable(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const editableExts = ['js','ts','jsx','tsx','py','rb','go','java','cpp','c','php',
    'html','htm','css','scss','json','yaml','yml','toml','env','txt','md','sh','xml','svg'];
  return editableExts.includes(ext) || !name.includes('.');
}

export default function FileManager({ projectId, appId }: FileManagerProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries]         = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent]   = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newName, setNewName]         = useState('');
  const [renaming, setRenaming]       = useState<string | null>(null);
  const [renameTo, setRenameTo]       = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const loadDir = async (p = currentPath) => {
    setLoading(true);
    try {
      const data = await api.list(appId, p);
      if (data.entries) setEntries(data.entries);
      else setMsg(data.error || 'Gagal load.');
    } catch { setMsg('Gagal load direktori.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadDir('/'); }, [appId]);

  const openFile = async (name: string) => {
    const filePath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    setLoading(true);
    try {
      const data = await api.read(appId, filePath);
      if (data.content !== undefined) {
        setSelectedFile(filePath);
        setFileContent(data.content);
        setOriginalContent(data.content);
      } else {
        setMsg(data.error || 'Gagal buka file.');
      }
    } catch { setMsg('Gagal buka file.'); }
    finally { setLoading(false); }
  };

  const openDir = (name: string) => {
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    setCurrentPath(newPath);
    setSelectedFile(null);
    loadDir(newPath);
  };

  const goUp = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
    setCurrentPath(newPath);
    setSelectedFile(null);
    loadDir(newPath);
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const data = await api.write(appId, selectedFile, fileContent);
      if (data.ok) {
        setOriginalContent(fileContent);
        setMsg('✅ File disimpan!');
        setTimeout(() => setMsg(''), 3000);
      } else setMsg('❌ ' + data.error);
    } catch { setMsg('❌ Gagal simpan.'); }
    finally { setSaving(false); }
  };

  const createFile = async () => {
    if (!newName) return;
    const filePath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
    const data = await api.write(appId, filePath, '');
    if (data.ok) { setShowNewFile(false); setNewName(''); loadDir(); setMsg('✅ File dibuat.'); }
    else setMsg('❌ ' + data.error);
  };

  const createFolder = async () => {
    if (!newName) return;
    const dirPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
    const data = await api.mkdir(appId, dirPath);
    if (data.ok) { setShowNewFolder(false); setNewName(''); loadDir(); setMsg('✅ Folder dibuat.'); }
    else setMsg('❌ ' + data.error);
  };

  const deleteEntry = async (name: string, type: string) => {
    if (!confirm(`Hapus ${type === 'dir' ? 'folder' : 'file'} "${name}"?`)) return;
    const p = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    const data = await api.delete(appId, p);
    if (data.ok) { loadDir(); if (selectedFile === p) setSelectedFile(null); setMsg('✅ Berhasil dihapus.'); }
    else setMsg('❌ ' + data.error);
  };

  const doRename = async () => {
    if (!renaming || !renameTo) return;
    const oldPath = currentPath === '/' ? `/${renaming}` : `${currentPath}/${renaming}`;
    const newPath = currentPath === '/' ? `/${renameTo}` : `${currentPath}/${renameTo}`;
    const data = await api.rename(appId, oldPath, newPath);
    if (data.ok) { setRenaming(null); setRenameTo(''); loadDir(); setMsg('✅ Berhasil direname.'); }
    else setMsg('❌ ' + data.error);
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);
  const isDirty = fileContent !== originalContent;

  return (
    <div className="flex h-full min-h-[500px] rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0D0F1A]">
      {/* Sidebar - File Tree */}
      <div className="w-64 border-r border-white/5 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b border-white/5">
          <button onClick={goUp} disabled={currentPath === '/'} title="Naik folder"
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white disabled:opacity-30 transition-all">
            <ArrowLeft size={14}/>
          </button>
          <button onClick={() => loadDir()} title="Refresh"
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all">
            <RefreshCw size={14}/>
          </button>
          <div className="flex-1"/>
          <button onClick={() => { setShowNewFile(true); setShowNewFolder(false); setNewName(''); }} title="File baru"
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all">
            <Plus size={14}/>
          </button>
          <button onClick={() => { setShowNewFolder(true); setShowNewFile(false); setNewName(''); }} title="Folder baru"
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all">
            <FolderPlus size={14}/>
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="px-3 py-1.5 border-b border-white/5 flex items-center gap-1 text-xs text-gray-600 overflow-x-auto">
          <button onClick={() => { setCurrentPath('/'); loadDir('/'); }} className="hover:text-gray-400">root</button>
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={10}/>
              <button onClick={() => {
                const p = '/' + breadcrumbs.slice(0, i+1).join('/');
                setCurrentPath(p); loadDir(p);
              }} className="hover:text-gray-400 truncate max-w-[60px]">{part}</button>
            </span>
          ))}
        </div>

        {/* New file/folder input */}
        {(showNewFile || showNewFolder) && (
          <div className="px-3 py-2 border-b border-white/5">
            <div className="flex items-center gap-1">
              {showNewFolder ? <Folder size={13} className="text-yellow-400"/> : <File size={13} className="text-blue-400"/>}
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') showNewFile ? createFile() : createFolder(); if (e.key === 'Escape') { setShowNewFile(false); setShowNewFolder(false); } }}
                placeholder={showNewFile ? 'nama-file.js' : 'nama-folder'}
                className="flex-1 bg-transparent text-xs text-white outline-none placeholder-gray-600"/>
              <button onClick={showNewFile ? createFile : createFolder} className="text-green-400 hover:text-green-300"><Check size={13}/></button>
              <button onClick={() => { setShowNewFile(false); setShowNewFolder(false); }} className="text-gray-600 hover:text-red-400"><X size={13}/></button>
            </div>
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 size={18} className="animate-spin text-gray-600"/>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-8">Folder kosong</p>
          ) : (
            entries.map(entry => (
              <div key={entry.name} className="group relative">
                {renaming === entry.name ? (
                  <div className="flex items-center gap-1 px-3 py-1.5">
                    <input autoFocus value={renameTo} onChange={e => setRenameTo(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') doRename(); if (e.key === 'Escape') setRenaming(null); }}
                      className="flex-1 bg-white/10 rounded px-1 text-xs text-white outline-none"/>
                    <button onClick={doRename} className="text-green-400"><Check size={12}/></button>
                    <button onClick={() => setRenaming(null)} className="text-gray-600"><X size={12}/></button>
                  </div>
                ) : (
                  <button
                    onClick={() => entry.type === 'dir' ? openDir(entry.name) : (isEditable(entry.name) ? openFile(entry.name) : setMsg('File ini tidak bisa diedit.'))}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-all hover:bg-white/5 ${
                      selectedFile === (currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`)
                        ? 'bg-indigo-500/10 text-indigo-300' : 'text-gray-400'
                    }`}
                  >
                    {getFileIcon(entry.name, entry.type)}
                    <span className="flex-1 truncate text-left">{entry.name}</span>
                    {entry.type === 'dir' && <ChevronRight size={11} className="text-gray-600"/>}
                  </button>
                )}
                {/* Context actions */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-[#0D0F1A] rounded">
                  <button onClick={() => { setRenaming(entry.name); setRenameTo(entry.name); }} title="Rename"
                    className="p-1 text-gray-600 hover:text-yellow-400 transition-colors">
                    <Edit3 size={11}/>
                  </button>
                  <button onClick={() => deleteEntry(entry.name, entry.type)} title="Hapus"
                    className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={11}/>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            {/* Editor header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFile.split('/').pop() || '', 'file')}
                <span className="text-xs text-gray-400 font-mono">{selectedFile}</span>
                {isDirty && <span className="w-2 h-2 rounded-full bg-orange-400" title="Ada perubahan yang belum disimpan"/>}
              </div>
              <button onClick={saveFile} disabled={saving || !isDirty}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-xs text-indigo-300 hover:bg-indigo-500/30 disabled:opacity-40 transition-all">
                {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
                Simpan
              </button>
            </div>
            {/* Textarea editor */}
            <textarea
              ref={editorRef}
              value={fileContent}
              onChange={e => setFileContent(e.target.value)}
              onKeyDown={e => {
                // Ctrl+S untuk save
                if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); }
                // Tab key
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end   = e.currentTarget.selectionEnd;
                  setFileContent(prev => prev.substring(0, start) + '  ' + prev.substring(end));
                  setTimeout(() => { if (editorRef.current) { editorRef.current.selectionStart = start + 2; editorRef.current.selectionEnd = start + 2; } }, 0);
                }
              }}
              className="flex-1 p-4 bg-transparent text-xs text-gray-300 font-mono resize-none outline-none leading-relaxed"
              spellCheck={false}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText size={40} className="text-gray-700 mx-auto mb-3"/>
              <p className="text-sm text-gray-600">Pilih file untuk diedit</p>
              <p className="text-xs text-gray-700 mt-1">Ctrl+S untuk simpan</p>
            </div>
          </div>
        )}
      </div>

      {/* Toast message */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:20 }}
            className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-50 ${
              msg.startsWith('✅') ? 'bg-green-500/20 border border-green-500/30 text-green-300'
              : msg.startsWith('❌') ? 'bg-red-500/20 border border-red-500/30 text-red-300'
              : 'bg-white/10 border border-white/20 text-white'
            }`}>
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
