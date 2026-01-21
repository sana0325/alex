import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Note } from '../types';
import { Save, Trash2 } from 'lucide-react';

interface NotesPanelProps {
  symbol: string;
  user: any;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ symbol, user }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      fetchNotes();
    }
  }, [symbol, user]);

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('pair_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('symbol', symbol)
      .order('created_at', { ascending: false });
    
    if (!error && data) setNotes(data);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setLoading(true);

    if (isSupabaseConfigured()) {
        const { error } = await supabase.from('pair_notes').insert([
        { user_id: user.id, symbol, content: newNote }
        ]);
        if (!error) {
            setNewNote('');
            fetchNotes();
        }
    } else {
        // Mock for missing keys
        const mockNote: Note = {
            id: Date.now(),
            user_id: user.id,
            symbol,
            content: newNote,
            created_at: new Date().toISOString()
        };
        setNotes([mockNote, ...notes]);
        setNewNote('');
    }
    setLoading(false);
  };

  const deleteNote = async (id: number) => {
    if (isSupabaseConfigured()) {
        await supabase.from('pair_notes').delete().eq('id', id);
        fetchNotes();
    } else {
        setNotes(notes.filter(n => n.id !== id));
    }
  };

  return (
    <div className="bg-[#111827] rounded-lg border border-gray-800 p-4 flex flex-col h-[400px]">
      <h3 className="text-gray-200 font-semibold mb-4">Trading Notes: {symbol}</h3>
      
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a trade idea or observation..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
        />
        <button 
          onClick={addNote}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors disabled:opacity-50"
        >
          <Save size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {notes.length === 0 ? (
           <div className="text-gray-600 text-center text-sm py-10 italic">No notes for this pair yet.</div>
        ) : (
            notes.map(note => (
            <div key={note.id} className="bg-gray-900/50 p-3 rounded border border-gray-800 group relative">
                <p className="text-sm text-gray-300 pr-6">{note.content}</p>
                <div className="text-[10px] text-gray-600 mt-2">
                {new Date(note.created_at).toLocaleString()}
                </div>
                <button 
                onClick={() => deleteNote(note.id)}
                className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                <Trash2 size={14} />
                </button>
            </div>
            ))
        )}
      </div>
    </div>
  );
};
