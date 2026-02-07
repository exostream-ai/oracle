import { ForwardData } from '../../src/lib/api';

export const mockForwards = {
  ticker: 'OPUS-4.5',
  model_id: 'claude-opus-4.5',
  display_name: 'Claude Opus 4.5',
  spot: 15.0,
  theta: 0.03,
  forwards: [
    {
      tenor: '1M',
      beta_forward: 15.45,
      decay_factor: 0.997,
    },
    {
      tenor: '3M',
      beta_forward: 16.38,
      decay_factor: 0.991,
    },
    {
      tenor: '6M',
      beta_forward: 17.95,
      decay_factor: 0.982,
    },
  ] as ForwardData[],
};
