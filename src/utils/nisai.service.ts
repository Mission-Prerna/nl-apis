import axios from 'axios';

const NISAI_BASE_URL = process.env.NISAI_URL;

export async function fetchQuestionsByIds(questionIds: string[]) {
  console.log('questionIds:', questionIds);
  // const { data } = await axios.post(`${NISAI_BASE_URL}/v1/finalReport/single`, {
  //   questionId,
  // });
  // return data;
  return [
    {
      id: 'ques_osHUiJOwvKTu',
      text: '3 + 5',
      type: 'single-select',
      choices: [
        {
          id: 'nl_g1m_1805_51_ques_1_right',
          text: 'सही उत्तर',
          score: 1,
        },
        {
          id: 'nl_g1m_1805_51_ques_1_wrong_1',
          text: 'ग़लत उत्तर',
          score: 0,
        },
        {
          id: 'nl_g1m_1805_51_ques_1_wrong_2',
          text: 'कोई उत्तर नहीं',
          score: 0,
        },
      ],
      randomize: false,
    },
    {
      id: 'ques_SHsEkwRRSjSv',
      text: '3 + 5',
      type: 'single-select',
      choices: [
        {
          id: 'nl_g1m_1805_51_ques_1_right',
          text: 'सही उत्तर नहीं',
          score: 0,
        },
        {
          id: 'nl_g1m_1805_51_ques_1_wrong_1',
          text: 'ग़लत उत्तर',
          score: 0,
        },
        {
          id: 'nl_g1m_1805_51_ques_1_wrong_2',
          text: 'सही उत्तर',
          score: 1,
        },
      ],
      randomize: false,
    },
    {
      id: 'ques_WrrzVKmoFUgu',
      text: '3 + 5',
      type: 'single-select',
      choices: [
        {
          id: 'nl_g1m_1805_51_ques_1_right',
          text: 'कोई उत्तर नहीं',
          score: 0,
        },
        {
          id: 'nl_g1m_1805_51_ques_1_wrong_1',
          text: 'ग़लत उत्तर',
          score: 0,
        },
        {
          id: 'nl_g1m_1805_51_ques_1_wrong_2',
          text: 'सही उत्तर',
          score: 1,
        },
      ],
      randomize: false,
    },
    {
      id: 'ques_0lCGwoyT2pqo',
      text: '3 + 5',
      type: 'single-select',
      choices: [
        {
          id: 'nl_g1m_1805_51_ques_1_right',
          text: 'ग़लत उत्तर',
          score: 0,
        },
        {
          id: 'nl_g1m_1805_51_ques_1_wrong_1',
          text: 'सही उत्तर',
          score: 1,
        },
        {
          id: 'nl_g1m_1805_51_ques_1_wrong_2',
          text: 'कोई उत्तर नहीं',
          score: 0,
        },
      ],
      randomize: false,
    },
  ];
}
