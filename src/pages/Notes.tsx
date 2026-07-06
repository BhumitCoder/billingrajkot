import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { getNotes, getNotesByDate, saveNote, deleteNote, updateNoteStatus } from '@/lib/firebaseService';
import { Note } from '@/types';
import { Plus, Edit, Trash2, Calendar as CalendarIcon, Loader2, StickyNote, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/billUtils';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isOpen, setIsOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [formData, setFormData] = useState({
    content: '',
  });

  useEffect(() => {
    loadNotes();
  }, [selectedDate]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const notesData = await getNotesByDate(dateStr);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.content.trim()) {
      toast.error('Please enter note content');
      return;
    }

    setSaving(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const note: Note = {
        id: editingNote?.id || crypto.randomUUID(),
        date: dateStr,
        content: formData.content.trim(),
        isDone: editingNote?.isDone || false,
        createdAt: editingNote?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveNote(note);
      await loadNotes();

      setIsOpen(false);
      setEditingNote(null);
      resetForm();

      toast.success(editingNote ? 'Note updated successfully' : 'Note added successfully');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setFormData({
      content: note.content,
    });
    setIsOpen(true);
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      await loadNotes();
      toast.success('Note deleted successfully');
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const handleToggleDone = async (note: Note) => {
    try {
      await updateNoteStatus(note.id, !note.isDone);
      await loadNotes();
      toast.success(note.isDone ? 'Note marked as undone' : 'Note marked as done');
    } catch (error) {
      toast.error('Failed to update note status');
    }
  };

  const resetForm = () => {
    setFormData({
      content: '',
    });
  };

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const activeNotes = notes.filter(n => !n.isDone);
  const doneNotes = notes.filter(n => n.isDone);
  const totalNotes = notes.length;
  const completionRate = totalNotes > 0 ? Math.round((doneNotes.length / totalNotes) * 100) : 0;

  // Get dates with notes for calendar highlighting
  const [datesWithNotes, setDatesWithNotes] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const loadAllNotes = async () => {
      try {
        const allNotes = await getNotes();
        const dates = new Set(allNotes.map(n => n.date));
        setDatesWithNotes(dates);
      } catch (error) {
        console.error('Error loading all notes:', error);
      }
    };
    loadAllNotes();
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
              <StickyNote className="h-5 w-5" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                Notes
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your daily notes and reminders
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 lg:w-auto">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="h-10 rounded-xl px-3 text-sm"
                  onClick={() => {
                    setEditingNote(null);
                    resetForm();
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </Button>
              </DialogTrigger>

            <DialogContent className="dialog-form-content sm:max-w-[500px]">
              <DialogHeader className="dialog-form-header">
                <DialogTitle>
                  {editingNote ? "Edit Note" : "Add New Note"}
                </DialogTitle>
              </DialogHeader>

              <form
                onSubmit={handleSubmit}
                className="dialog-form-body space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? (
                          format(selectedDate, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          if (date) {
                            setSelectedDate(date);
                            setCalendarOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Note Content *</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) =>
                      setFormData({ ...formData, content: e.target.value })
                    }
                    placeholder="Enter your note..."
                    rows={5}
                    required
                  />
                </div>

                <div className="dialog-form-footer flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingNote ? "Update" : "Add"} Note
                  </Button>
                </div>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
        <div className="h-full overflow-y-auto space-y-4 pr-1 sm:pr-2">
          {/* Calendar and Notes Section */}
          <div className="grid grid-cols-1 gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start">
            {/* Calendar */}
            <Card className="self-start border-border/70 bg-background/90 shadow-sm lg:flex lg:h-full lg:min-h-0 lg:w-[330px] lg:flex-col">
              <CardHeader className="border-b bg-muted/20 pb-3">
                <CardTitle className="text-base sm:text-lg">
                  Date & Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-3 sm:p-4 lg:min-h-0 lg:overflow-y-auto">
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setSelectedDate(date);
                      }
                    }}
                    modifiers={{
                      hasNotes: (date) => {
                        const dateStr = format(date, "yyyy-MM-dd");
                        return datesWithNotes.has(dateStr);
                      },
                    }}
                    modifiersClassNames={{
                      hasNotes:
                        "bg-primary/15 text-primary font-semibold border border-primary/30",
                    }}
                    className="w-fit rounded-xl border border-border/70 bg-background p-2 sm:p-3 shadow-sm"
                    classNames={{
                      table: "w-auto border-collapse",
                      head_row: "flex justify-between",
                      row: "flex justify-between mt-2",
                    }}
                  />
                </div>
                <div className="rounded-xl border border-border/70 bg-background p-3 shadow-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Selected Date
                  </p>
                  <p className="text-sm font-semibold sm:text-base">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Overview
                    </p>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {completionRate}% done
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Total
                      </p>
                      <p className="font-bold text-foreground">{totalNotes}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-blue-50/70 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Active
                      </p>
                      <p className="font-bold text-blue-600">
                        {activeNotes.length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-emerald-50/70 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">
                        Done
                      </p>
                      <p className="font-bold text-emerald-600">
                        {doneNotes.length}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Completion Progress
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes List */}
            <Card className="flex min-h-0 min-w-0 flex-col border-border/70 bg-background/90 shadow-sm lg:h-full">
              <CardHeader className="border-b bg-muted/20 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg">
                    Notes for {format(selectedDate, "MMMM d, yyyy")}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                      Active: {activeNotes.length}
                    </span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                      Done: {doneNotes.length}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col p-4">
                {loading ? (
                  <LoadingSpinner size="lg" text="Loading notes..." />
                ) : notes.length === 0 ? (
                  <div className="flex h-full min-h-[260px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 text-center text-muted-foreground">
                    <div>
                      <StickyNote className="h-16 w-16 mx-auto mb-4 opacity-40" />
                      <p className="text-lg">No notes for this date</p>
                      <p className="text-sm mt-2">
                        Click "Add Note" to create your first note
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[56vh] min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 lg:h-full lg:max-h-none">
                    {/* Active Notes */}
                    {activeNotes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <Circle className="h-4 w-4" />
                          Active Notes ({activeNotes.length})
                        </h3>
                        <div className="space-y-3">
                          {activeNotes.map((note) => (
                            <div
                              key={note.id}
                              className="flex items-start gap-3 rounded-xl border border-border/70 bg-background p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                            >
                              <button
                                onClick={() => handleToggleDone(note)}
                                className="mt-1 flex-shrink-0"
                                aria-label="Mark as done"
                              >
                                <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                                  {note.content}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Created: {formatDate(note.createdAt)}
                                </p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(note)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Delete Note
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this
                                        note? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(note.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Done Notes */}
                    {doneNotes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Completed Notes ({doneNotes.length})
                        </h3>
                        <div className="space-y-3">
                          {doneNotes.map((note) => (
                            <div
                              key={note.id}
                              className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 opacity-80"
                            >
                              <button
                                onClick={() => handleToggleDone(note)}
                                className="mt-1 flex-shrink-0"
                                aria-label="Mark as undone"
                              >
                                <CheckCircle2 className="h-5 w-5 text-primary" />
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-muted-foreground line-through whitespace-pre-wrap break-words">
                                  {note.content}
                                </p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Created: {formatDate(note.createdAt)}
                                </p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(note)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        Delete Note
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this
                                        note? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(note.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}





