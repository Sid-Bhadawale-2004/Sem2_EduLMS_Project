import React from 'react';
import {
  Card, CardContent, Typography, Box, Button, Chip, IconButton,
} from '@mui/material';
import {
  Download, Delete, OpenInNew,
} from '@mui/icons-material';
import { format } from 'date-fns';

const amber = '#f59e0b';

const getFileIcon = (url) => {
  if (!url) return '📄';
  const ext = url.split('.').pop()?.toLowerCase();
  const icons = {
    pdf: '📕', doc: '📘', docx: '📘', ppt: '📙', pptx: '📙',
    xls: '📗', xlsx: '📗', zip: '📦', jpg: '🖼️', jpeg: '🖼️',
    png: '🖼️', gif: '🖼️', mp4: '🎬', mp3: '🎵'
  };
  return icons[ext] || '📎';
};

export default function NoteCard({
  note,
  isFaculty,
  onDownload,
  onDelete,
}) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        border: '1px solid rgba(0,0,0,0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        '&:hover': {
          boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
          transform: 'translateY(-4px)',
          borderColor: amber,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Header with File Icon & Title */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'flex-start' }}>
          <Typography sx={{ fontSize: '2.5rem', flexShrink: 0 }}>
            {getFileIcon(note.fileUrl)}
          </Typography>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                mb: 0.75,
                wordBreak: 'break-word',
                color: '#111827',
                fontSize: '1.1rem',
              }}
            >
              {note.title}
            </Typography>
            <Chip
              label={note.subject?.name || 'Subject'}
              size="small"
              variant="outlined"
              sx={{
                borderColor: amber,
                color: amber,
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          </Box>
        </Box>

        {/* Description */}
        {note.description && (
          <Typography
            variant="body2"
            sx={{
              color: '#6b7280',
              mb: 1.5,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {note.description}
          </Typography>
        )}

        {/* Topic Tag */}
        {note.topic && (
          <Box sx={{ mb: 1.5 }}>
            <Chip
              label={`📌 ${note.topic}`}
              size="small"
              sx={{
                bgcolor: `${amber}15`,
                color: amber,
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          </Box>
        )}

        {/* Faculty & Date Information */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 1.5,
            fontSize: '0.875rem',
            color: '#6b7280',
            flexWrap: 'wrap',
          }}
        >
          <span>👤</span>
          <Typography variant="caption" sx={{ color: 'inherit' }}>
            {note.faculty?.name || 'Unknown Faculty'}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: '0.875rem',
            color: '#6b7280',
            flexWrap: 'wrap',
          }}
        >
          <span>📅</span>
          <Typography variant="caption" sx={{ color: 'inherit' }}>
            {format(new Date(note.createdAt), 'dd MMM yyyy')}
          </Typography>
        </Box>
      </CardContent>

      {/* Action Buttons */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          p: 2,
          pt: 0,
          borderTop: '1px solid rgba(0,0,0,0.06)',
          flexWrap: 'wrap',
        }}
      >
        {note.fileUrl && (
          <>
            <Button
              size="small"
              variant="contained"
              startIcon={<OpenInNew />}
              onClick={() => window.open(note.fileUrl, '_blank')}
              fullWidth
              sx={{
                bgcolor: '#3b82f6',
                color: 'white',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { bgcolor: '#1d4ed8' },
              }}
            >
              View
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Download />}
              onClick={() => onDownload(note.fileUrl, note.title)}
              fullWidth
              sx={{
                bgcolor: '#10b981',
                color: 'white',
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              Download
            </Button>
          </>
        )}
        {isFaculty && (
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(note.id)}
            sx={{
              flex: 0,
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 1,
            }}
          >
            <Delete fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Card>
  );
}
