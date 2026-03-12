import { useCallback, useState } from 'react'
import { uploadApi } from '@/api'
import { Button } from '@/components/ui/button'

interface ImageUploadProps {
  onUploaded: (url: string, fileId: number) => void
}

export function ImageUpload({ onUploaded }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const res = await uploadApi.upload(file)
      const data = res.data.data
      onUploaded(data.url, data.id)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [onUploaded])

  return (
    <Button variant="outline" size="sm" disabled={uploading} onClick={() => document.getElementById('image-upload-input')?.click()}>
      {uploading ? '上传中...' : '上传图片'}
      <input
        id="image-upload-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </Button>
  )
}
