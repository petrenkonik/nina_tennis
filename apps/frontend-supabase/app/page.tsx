"use client";
import React from 'react';
import MainLayout from 'app/main-layout';
import AllTournaments from './tournaments/all-tournaments';


export default function HomePage() {
 
  return (
    <MainLayout header="Теннисные турниры">
      <AllTournaments></AllTournaments>

    </MainLayout>
  );
} 

