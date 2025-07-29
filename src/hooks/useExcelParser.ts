import { parseExcelSheet } from '@/lib/excelUtils';
import { useCallback } from 'react';
import { UPLOAD_CONFIGS, type UploadType } from '@/lib/uploadConstants';
import type { ProductListingUploadError } from '@/lib/types';

export function useExcelParser(uploadType: UploadType) {
  const config = UPLOAD_CONFIGS[uploadType];

  const parseFile = useCallback(async (file: File) => {
    const fileDataBuffer = await file.arrayBuffer();
    const { parsedEntries, rowsSkippedForMissingMandatoryValue, parsingErrors } = parseExcelSheet(
      fileDataBuffer,
      config.mapping,
      config.numericFields,
      config.dataTypeForParser,
      config.mandatoryKey,
      config.mandatoryName,
      config.secondaryMandatoryKeys
    );
    return {
      parsedEntries,
      rowsSkippedForMissingMandatory: rowsSkippedForMissingMandatoryValue,
      parsingErrors: parsingErrors.map(e => ({ rowIndexInExcel: 0, error: `${uploadType.charAt(0).toUpperCase() + uploadType.slice(1)} Parsing: ${e}` })) as ProductListingUploadError[],
    };
  }, [config, uploadType]);

  return { parseFile };
}
