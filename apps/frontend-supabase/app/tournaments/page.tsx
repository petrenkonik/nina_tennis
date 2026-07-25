"use client";
import React from 'react';
import MainLayout from 'app/main-layout';
import AllTournaments from './all-tournaments';


export default function TournamentsPage() {
 
  return (
    <MainLayout header="Все турниры">
      <AllTournaments></AllTournaments>

    </MainLayout>
  );
} 