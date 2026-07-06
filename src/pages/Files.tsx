import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/alert-dialog";
import {
  uploadFile,
  getFiles,
  deleteFile,
  downloadFile,
} from "@/lib/firebaseService";
import { UploadedFile } from "@/types";
import {
  Upload,
  Download,
  Trash2,
  File,
  Files as FilesIcon,
  HardDrive,
  Layers3,
  Loader2,
  Eye,
  ExternalLink,
  Search,
  Calendar,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/billUtils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Files() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    filterFiles();
  }, [files, searchQuery, dateFrom, dateTo]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const filesData = await getFiles();
      setFiles(filesData);
    } catch (error) {
      console.error("Error loading files:", error);
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const filterFiles = () => {
    let filtered = [...files];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (file) =>
          file.name.toLowerCase().includes(query) ||
          file.originalName.toLowerCase().includes(query) ||
          file.type.toLowerCase().includes(query),
      );
    }

    // Date filter
    if (dateFrom) {
      filtered = filtered.filter((file) => {
        const fileDate = new Date(file.uploadedAt || file.createdAt);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        return fileDate >= fromDate;
      });
    }

    if (dateTo) {
      filtered = filtered.filter((file) => {
        const fileDate = new Date(file.uploadedAt || file.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        return fileDate <= toDate;
      });
    }

    setFilteredFiles(filtered);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // For single file, show dialog for custom name
    if (selectedFiles.length === 1) {
      setSelectedFile(selectedFiles[0]);
      setCustomFileName(selectedFiles[0].name);
      setUploadDialogOpen(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // For multiple files, upload with original names
    setUploading(true);
    try {
      const uploadPromises = Array.from(selectedFiles).map((file) =>
        uploadFile(file),
      );
      await Promise.all(uploadPromises);
      await loadFiles();
      toast.success(`Successfully uploaded ${selectedFiles.length} file(s)`);
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUploadWithCustomName = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadDialogOpen(false);

    try {
      // Create a new File object with custom name if provided
      let fileToUpload = selectedFile;
      if (customFileName.trim() && customFileName !== selectedFile.name) {
        // Create a new Blob with custom name
        const blob = new Blob([selectedFile], { type: selectedFile.type });
        // Add name property to blob to mimic File behavior
        Object.defineProperty(blob, "name", {
          value: customFileName.trim(),
          writable: false,
        });
        Object.defineProperty(blob, "lastModified", {
          value: selectedFile.lastModified || Date.now(),
          writable: false,
        });
        fileToUpload = blob as File;
      }

      await uploadFile(fileToUpload);
      toast.success("File uploaded successfully");
      await loadFiles();
      setSelectedFile(null);
      setCustomFileName("");
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
  };

  const handleDownload = async (file: UploadedFile) => {
    try {
      await downloadFile(file.downloadUrl, file.originalName);
      toast.success("File download started");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  const handleView = (file: UploadedFile) => {
    // Open file in new tab for viewing
    if (file.downloadUrl) {
      window.open(file.downloadUrl, "_blank", "noopener,noreferrer");
    } else {
      toast.error("File URL not available");
    }
  };

  const handleDelete = async (file: UploadedFile) => {
    try {
      await deleteFile(file.id, file.storagePath);
      await loadFiles();
      toast.success("File deleted successfully");
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return "🖼️";
    if (fileType.includes("pdf")) return "📄";
    if (fileType.includes("word") || fileType.includes("document")) return "📝";
    if (fileType.includes("excel") || fileType.includes("spreadsheet"))
      return "📊";
    if (fileType.includes("zip") || fileType.includes("archive")) return "📦";
    return "📎";
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-20 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-slate-50/40 p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-border">
                <File className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <h1 className="truncate text-2xl font-semibold leading-tight sm:text-3xl">
                  Files
                </h1>
                <p className="text-sm text-muted-foreground">Upload and manage your files</p>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 rounded-xl border border-border/70 bg-muted/30 p-2 lg:w-auto">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-10 rounded-xl px-3 text-sm"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/70 p-2 sm:p-4">
          <div className="h-full overflow-y-auto space-y-4 sm:space-y-5 pr-1 sm:pr-2">
            {/* Filters */}
            <Card className="w-full max-w-full overflow-hidden">
              <CardContent className="pt-4 sm:pt-5 pb-4 sm:pb-5 px-3 sm:px-4 md:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search files..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 sm:h-11 border-2 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="pl-10 h-10 sm:h-11 border-2 text-sm"
                      placeholder="From Date"
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="pl-10 h-10 sm:h-11 border-2 text-sm"
                      placeholder="To Date"
                    />
                  </div>
                  {(searchQuery || dateFrom || dateTo) && (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="h-10 sm:h-11 text-sm touch-manipulation"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upload Dialog */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogContent className="dialog-form-content max-w-[90vw] sm:max-w-md">
                <DialogHeader className="dialog-form-header">
                  <DialogTitle>Upload File</DialogTitle>
                  <DialogDescription>
                    Enter a custom name for the file or use the original name
                  </DialogDescription>
                </DialogHeader>
                <div className="dialog-form-body space-y-4">
                  <div className="space-y-2">
                    <Label>Original File Name</Label>
                    <Input
                      value={selectedFile?.name || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom File Name (Optional)</Label>
                    <Input
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      placeholder={selectedFile?.name || "Enter custom name"}
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to use original file name
                    </p>
                  </div>
                </div>
                <DialogFooter className="dialog-form-footer flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadDialogOpen(false);
                      setSelectedFile(null);
                      setCustomFileName("");
                    }}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUploadWithCustomName}
                    disabled={uploading || !selectedFile}
                    className="w-full sm:w-auto"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Uploading Overlay */}
            {uploading && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                <Card className="w-[90vw] max-w-md">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <div className="text-center space-y-2">
                        <h3 className="text-lg font-semibold">
                          Uploading File...
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Please wait while your file is being uploaded
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Summary Card */}
            <Card className="w-full max-w-full overflow-hidden border-border/70">
              <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4 border-b bg-muted/20">
                <CardTitle className="text-base sm:text-lg md:text-xl flex items-center gap-2">
                  <FilesIcon className="h-4 w-4 text-primary" />
                  File Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 pb-3 sm:pb-4 md:pb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <FilesIcon className="h-3.5 w-3.5" />
                      Files
                    </p>
                    <div className="text-xl sm:text-2xl font-bold break-words text-primary">
                      {filteredFiles.length}{" "}
                      {searchQuery || dateFrom || dateTo
                        ? `of ${files.length}`
                        : ""}
                    </div>
                    <p className="text-xs text-muted-foreground break-words">
                      Visible in current filter
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <HardDrive className="h-3.5 w-3.5" />
                      Total Size
                    </p>
                    <div className="text-xl sm:text-2xl font-bold break-words text-emerald-600">
                      {formatFileSize(
                        filteredFiles.reduce((sum, f) => sum + f.size, 0),
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-words">
                      Combined file storage
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/80 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Layers3 className="h-3.5 w-3.5" />
                      File Types
                    </p>
                    <div className="text-xl sm:text-2xl font-bold break-words text-blue-600">
                      {
                        new Set(filteredFiles.map((f) => f.type.split("/")[0]))
                          .size
                      }
                    </div>
                    <p className="text-xs text-muted-foreground break-words">
                      Distinct categories
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Files Table */}
            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg md:text-xl">
                  Uploaded Files
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 sm:px-3 md:px-4 lg:px-6 pb-3 sm:pb-4 md:pb-6">
                {loading ? (
                  <LoadingSpinner size="lg" text="Loading files..." />
                ) : filteredFiles.length === 0 ? (
                  <div className="text-center py-8 sm:py-12 text-muted-foreground">
                    <File className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 opacity-40" />
                    <p className="text-sm sm:text-base md:text-lg break-words">
                      {files.length === 0
                        ? "No files uploaded yet"
                        : "No files match your filters"}
                    </p>
                    <p className="text-xs sm:text-sm mt-2 break-words">
                      {files.length === 0
                        ? 'Click "Upload Files" to upload your first file'
                        : "Try adjusting your search or date filters"}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border w-full max-w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs sm:text-sm">
                            Name
                          </TableHead>
                          <TableHead className="text-xs sm:text-sm hidden sm:table-cell">
                            Type
                          </TableHead>
                          <TableHead className="text-xs sm:text-sm">
                            Size
                          </TableHead>
                          <TableHead className="text-xs sm:text-sm hidden md:table-cell">
                            Upload Date
                          </TableHead>
                          <TableHead className="text-right text-xs sm:text-sm">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFiles.map((file) => (
                          <TableRow key={file.id}>
                            <TableCell className="min-w-[150px] sm:min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <span className="text-lg sm:text-xl flex-shrink-0">
                                  {getFileIcon(file.type)}
                                </span>
                                <span className="font-medium text-xs sm:text-sm truncate break-words">
                                  {file.name}
                                </span>
                              </div>
                              <div className="sm:hidden text-xs text-muted-foreground mt-1">
                                {file.type || "Unknown"} •{" "}
                                {formatDate(file.uploadedAt || file.createdAt)}
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span className="text-xs sm:text-sm text-muted-foreground break-words">
                                {file.type || "Unknown"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs sm:text-sm text-muted-foreground break-words">
                                {formatFileSize(file.size)}
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs sm:text-sm text-muted-foreground break-words">
                                {formatDate(file.uploadedAt || file.createdAt)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 sm:gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleView(file)}
                                  title="View file"
                                  className="h-8 w-8 sm:h-9 sm:w-9 p-0 touch-manipulation"
                                >
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownload(file)}
                                  title="Download file"
                                  className="h-8 w-8 sm:h-9 sm:w-9 p-0 touch-manipulation"
                                >
                                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      title="Delete file"
                                      className="h-8 w-8 sm:h-9 sm:w-9 p-0 touch-manipulation"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-base sm:text-lg">
                                        Delete File
                                      </AlertDialogTitle>
                                      <AlertDialogDescription className="text-sm break-words">
                                        Are you sure you want to delete "
                                        {file.name}"? This action cannot be
                                        undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                      <AlertDialogCancel className="w-full sm:w-auto">
                                        Cancel
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(file)}
                                        className="w-full sm:w-auto"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
      </div>
    </div>
  );
}
