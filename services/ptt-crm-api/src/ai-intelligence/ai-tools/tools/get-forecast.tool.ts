import { AiForecastService } from '../../ai-forecast.service';
import { AiToolDefinition } from '../ai-tools.types';

function optionalPositiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function createForecastTools(forecast: AiForecastService): AiToolDefinition[] {
  return [
    {
      name: 'get_forecast_snapshot',
      description: 'Get the latest revenue forecast snapshot for a month.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          year: { type: 'integer', minimum: 2000, maximum: 2100 },
          month: { type: 'integer', minimum: 1, maximum: 12 },
        },
      },
      outputSchema: { type: 'object' },
      mutating: false,
      requiredCaps: ['crm_business_dashboard.view'],
      handler: async (input, context) => {
        const response = await forecast.getDashboard(
          optionalPositiveInteger(input.year),
          optionalPositiveInteger(input.month),
          context.correlationId,
        );
        return response.data;
      },
    },
  ];
}
