
import { useState, useRef } from 'react';

import { Upload, FileText, FolderOpen, Archive, X } from 'lucide-react';



interface UploadZoneProps {

  onChange: (files: File[]) => void;

  files: File[];

}



export default function UploadZone({ onChange, files }: UploadZoneProps) {

  const [dragging, setDragging] = useState(false);

  const fileRef   = useRef<HTMLInputElement>(null);

  const folderRef = useRef<HTMLInputElement>(null);



  const addFiles = (newFiles: FileList | null) => {

    if (!newFiles) return;

    const arr = Array.from(newFiles);

    onChange([...files, ...arr]);

  };



  const removeFile = (i: number) => {

    onChange(files.filter((_, idx) => idx !== i));

  };



  const getIcon = (name: string) => {

    const ext = name.split('.').pop()?.toLowerCase();

    if (ext === 'zip') return <Archive size={14} className="text-yellow-400" />;

    if (['html','htm'].includes(ext||'')) return <FileText size={14} className="text-blue-400" />;

    return <FileText size={14} className="text-gray-400" />;

  };



  const totalSize = files.reduce((a, f) => a + f.size, 0);

  const formatSize = (b: number) => b < 1024*1024 ? `${(b/1024).toFixed(1)}KB` : `${(b/1024/1024).toFixed(1)}MB`;



  return (

    <div className="space-y-3">

      <div

        onDragOver={e => { e.preventDefault(); setDragging(true); }}

        onDragLeave={() => setDragging(false)}

        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}

        className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${

          dragging ? 'border-indigo-500/60 bg-indigo-500/10'

          : files.length > 0 ? 'border-indigo-500/40 bg-indigo-500/5'

          : 'border-white/10 hover:border-white/20 bg-white/[0.02]'

        }`}

      >

        <Upload size={24} className={files.length > 0 ? 'text-indigo-400' : 'text-gray-600'} />

        <div className="text-center">

          <p className="text-sm text-gray-400 mb-1">Drag & drop file kesini</p>

          <p className="text-xs text-gray-600">ZIP · HTML · CSS · JS · atau Folder</p>

        </div>

        <div className="flex gap-2 mt-1">

          <button type="button" onClick={() => fileRef.current?.click()}

            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:bg-white/10 transition-all">

            <FileText size={12} /> Pilih File

          </button>

          <button type="button" onClick={() => folderRef.current?.click()}

            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400 hover:bg-white/10 transition-all">

            <FolderOpen size={12} /> Pilih Folder

          </button>

        </div>

        <input ref={fileRef} type="file" multiple

          accept=".zip,.html,.htm,.css,.js,.ts,.tsx,.jsx,.json,.png,.jpg,.svg,.ico"

          className="hidden" onChange={e => addFiles(e.target.files)} />

        <input ref={folderRef} type="file" multiple

          // @ts-ignore

          webkitdirectory="" directory=""

          className="hidden" onChange={e => addFiles(e.target.files)} />

      </div>



      {files.length > 0 && (

        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">

          <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">

            <span className="text-xs text-gray-500">{files.length} file · {formatSize(totalSize)}</span>

            <button type="button" onClick={() => onChange([])}

              className="text-xs text-gray-600 hover:text-red-400 transition-colors">Clear all</button>

          </div>

          <div className="max-h-40 overflow-y-auto divide-y divide-white/5">

            {files.slice(0, 20).map((f, i) => (

              <div key={i} className="flex items-center gap-2 px-4 py-2">

                {getIcon(f.name)}

                <span className="flex-1 text-xs text-gray-400 truncate">{f.name}</span>

                <span className="text-xs text-gray-600">{formatSize(f.size)}</span>

                <button type="button" onClick={() => removeFile(i)}

                  className="text-gray-700 hover:text-red-400 transition-colors ml-1">

                  <X size={12} />

                </button>

              </div>

            ))}

            {files.length > 20 && (

              <div className="px-4 py-2 text-xs text-gray-600">+{files.length - 20} file lainnya...</div>

            )}

          </div>

        </div>

      )}

    </div>

  );

}

