// Handles file upload, parsing, and processing for marketing data
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud } from 'lucide-react';

interface FileUploadProps {
  isProcessingFile: boolean;
  selectedFile: File | null;
  fileName: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleUploadButtonClick: () => void;
  uploadProgressMessage: string | null;
}

const FileUpload: React.FC<FileUploadProps> = ({
  isProcessingFile,
  selectedFile,
  fileName,
  fileInputRef,
  handleFileChange,
  handleUploadButtonClick,
  uploadProgressMessage,
}) => (
  <div className="flex flex-col gap-2">
    <Input
      id="marketing-file-upload-hidden"
      type="file"
      ref={fileInputRef}
      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
      onChange={handleFileChange}
      className="hidden"
    />
    <Button
      onClick={handleUploadButtonClick}
      disabled={isProcessingFile}
      variant="default"
      size="sm"
      className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
    >
      <UploadCloud className="mr-2 h-4 w-4" />
      {selectedFile && fileName ? `Process: ${fileName.substring(0, 20)}${fileName.length > 20 ? '...' : ''}` : "Upload Excel"}
    </Button>
    {uploadProgressMessage && <p className="text-sm text-primary">{uploadProgressMessage}</p>}
  </div>
);

export default FileUpload;
