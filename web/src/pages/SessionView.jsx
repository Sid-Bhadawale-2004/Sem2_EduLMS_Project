import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import Layout from '../components/Layout';

export default function SessionView() {
  const { id } = useParams();
  return (
    <Layout title="Session View" navItems={[]}>
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6">Session: {id}</Typography>
      </Box>
    </Layout>
  );
}
