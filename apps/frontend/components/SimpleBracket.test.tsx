import React from 'react';
import { render, screen } from '@testing-library/react';
import SimpleBracket, { RoundProps } from './SimpleBracket';

describe('SimpleBracket', () => {
  const rounds: RoundProps[] = [
    {
      title: 'Раунд 1',
      seeds: [
        { id: '1', teams: [{ name: 'Игрок 1' }, { name: 'Игрок 2' }], score: '6:4, 7:5' },
        { id: '2', teams: [{ name: 'Игрок 3' }, { name: 'Игрок 4' }], score: '6:2, 6:3' },
      ],
    },
    {
      title: 'Финал',
      seeds: [
        { id: '3', teams: [{ name: 'Игрок 1' }, { name: 'Игрок 3' }], score: '6:3, 6:4' },
      ],
    },
  ];

  it('рендерит все раунды и матчи', () => {
    render(<SimpleBracket rounds={rounds} />);
    expect(screen.getByText('Раунд 1')).to.exist;
    expect(screen.getByText('Финал')).to.exist;
    expect(screen.getByText('Игрок 1')).to.exist;
    expect(screen.getByText('Игрок 2')).to.exist;
    expect(screen.getByText('6:4, 7:5')).to.exist;
  });
}); 