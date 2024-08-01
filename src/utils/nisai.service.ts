import axios from 'axios';

const NISAI_BASE_URL = process.env.NISAI_URL;

export async function fetchQuestionsByIds(questionIds: string[]) {
  const datasetIds = questionIds.join(',');
  const { data } = await axios.get(`${NISAI_BASE_URL}/client/dataset`, {
    params: {
      dataset_ids: datasetIds,
    },
    headers: {
      package: process.env.NISAI_PACKAGE,
      orgId: process.env.NISAI_ORG_ID,
      apiKey: process.env.NISAI_API_KEY,
    },
  });

  return data;
}
