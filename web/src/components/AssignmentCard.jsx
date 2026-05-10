import React from 'react';
import {
  Card, CardContent, Typography, Box, Button, Chip, IconButton,
  Alert,
} from '@mui/material';
import {
  Download, Grade, Warning, Upload, Edit, Delete, OpenInNew,
} from '@mui/icons-material';
import { format, isPast } from 'date-fns';

const amber = '#f59e0b';
const STATUS_COLORS = {
  SUBMITTED: { bg: '#3b82f6', label: 'primary' },
  GRADED: { bg: '#10b981', label: 'success' },
  LATE: { bg: '#f59e0b', label: 'warning' },
  PENDING: { bg: '#6b7280', label: 'default' },
};

const getFileIcon = (url) => {
  if (!url) return '📎';
  const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx'].includes(ext)) return '📘';
  if (['ppt', 'pptx'].includes(ext)) return '📙';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼️';
  return '📎';
};

export default function AssignmentCard({
  assignment,
  isFaculty,
  onViewSubmissions,
  onDelete,
  onSubmit,
}) {
  const mySub = assignment.submissions?.[0];
  const isOverdue = isPast(new Date(assignment.dueDate));

  const getStatusColor = (status) => {
    return STATUS_COLORS[status]?.label || 'default';
  };

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
        {/* Header: Subject + Status Chips */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Chip
            label={assignment.subject?.name || 'Subject'}
            size="small"
            variant="outlined"
            sx={{
              borderColor: amber,
              color: amber,
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          />
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {isOverdue && !mySub && (
              <Chip
                label="Overdue"
                size="small"
                color="error"
                icon={<Warning sx={{ fontSize: '1rem !important' }} />}
                sx={{ fontWeight: 500 }}
              />
            )}
            {mySub && (
              <Chip
                label={mySub.status}
                size="small"
                color={getStatusColor(mySub.status)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
            )}
            {mySub?.marks != null && (
              <Chip
                label={`${mySub.marks}/${assignment.maxMarks} pts`}
                size="small"
                color="success"
                sx={{ fontWeight: 600, fontSize: '0.75rem' }}
              />
            )}
          </Box>
        </Box>

        {/* Title */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            mb: 1,
            color: '#111827',
            fontSize: '1.1rem',
            lineHeight: 1.4,
          }}
        >
          {assignment.title}
        </Typography>

        {/* Description */}
        {assignment.description && (
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
            {assignment.description}
          </Typography>
        )}

        {/* Due Date & Marks */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 1.5,
            fontSize: '0.875rem',
            color: '#6b7280',
          }}
        >
          <span>📅</span>
          <Typography variant="caption" sx={{ color: 'inherit' }}>
            Due: {format(new Date(assignment.dueDate), 'dd MMM, hh:mm a')}
          </Typography>
        </Box>

        {/* Marks Info */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 1.5,
            fontSize: '0.875rem',
            color: '#6b7280',
          }}
        >
          <span>⭐</span>
          <Typography variant="caption" sx={{ color: 'inherit' }}>
            Max: {assignment.maxMarks} marks
          </Typography>
        </Box>

        {/* Assignment Attachment Button */}
        {assignment.fileUrl && (
          <Button
            component="a"
            href={assignment.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            startIcon={<OpenInNew />}
            variant="outlined"
            fullWidth
            sx={{
              mb: 1,
              borderColor: amber,
              color: amber,
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: `${amber}08`,
                borderColor: amber,
              },
            }}
          >
            {getFileIcon(assignment.fileUrl)} Assignment
          </Button>
        )}

        {/* Student's Submitted File */}
        {mySub?.fileUrl && (
          <Button
            component="a"
            href={mySub.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            startIcon={<Download />}
            variant="text"
            fullWidth
            sx={{
              mb: 1,
              color: '#10b981',
              fontWeight: 600,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: '#10b98108',
              },
            }}
          >
            {getFileIcon(mySub.fileUrl)} Your Submission
          </Button>
        )}

        {/* Feedback Alert */}
        {mySub?.feedback && (
          <Alert
            severity="success"
            sx={{
              mb: 1.5,
              py: 0.75,
              fontSize: '0.875rem',
              borderRadius: 2,
              '& .MuiAlert-icon': {
                fontSize: '1.25rem',
              },
            }}
          >
            <strong>Feedback:</strong> {mySub.feedback}
          </Alert>
        )}
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
        {isFaculty ? (
          <>
            <Button
              size="small"
              startIcon={<Grade />}
              variant="outlined"
              onClick={() => onViewSubmissions(assignment)}
              sx={{
                flex: 1,
                minWidth: '120px',
                borderColor: amber,
                color: amber,
                fontWeight: 600,
                textTransform: 'none',
                '&:hover': {
                  backgroundColor: `${amber}08`,
                  borderColor: amber,
                },
              }}
            >
              Submissions ({assignment._count?.submissions || 0})
            </Button>
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(assignment.id)}
              sx={{
                flex: 0,
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 1,
              }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </>
        ) : (
          <Button
            size="small"
            variant={mySub ? 'outlined' : 'contained'}
            startIcon={mySub ? <Edit /> : <Upload />}
            onClick={() => onSubmit(assignment)}
            disabled={mySub?.status === 'GRADED'}
            fullWidth
            sx={{
              fontWeight: 600,
              textTransform: 'none',
              ...(mySub
                ? {
                    borderColor: amber,
                    color: amber,
                    '&:hover': {
                      backgroundColor: `${amber}08`,
                      borderColor: amber,
                    },
                  }
                : {
                    backgroundColor: amber,
                    color: '#0f1923',
                    '&:hover': {
                      backgroundColor: '#d97706',
                    },
                  }),
              ...(mySub?.status === 'GRADED' && {
                opacity: 0.6,
                cursor: 'not-allowed',
              }),
            }}
          >
            {mySub?.status === 'GRADED' ? '✅ Graded' : mySub ? 'Edit Submission' : 'Submit'}
          </Button>
        )}
      </Box>
    </Card>
  );
}
