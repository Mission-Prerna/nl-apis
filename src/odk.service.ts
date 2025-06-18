//@ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as xml2js from 'xml2js';
import * as dotenv from 'dotenv';
import { PrismaService } from './prisma.service';
const fs = require('fs');

dotenv.config();

@Injectable()
export class OdkService {
  private readonly logger = new Logger(OdkService.name);
  private readonly baseUrl = process.env.CENTRAL_BASE_URL;
  private readonly projectId = process.env.CENTRAL_PROJECT_ID;

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  private async getAuthToken(): Promise<string> {
    const loginUrl = `${this.baseUrl}/v1/sessions`;
    const payload = {
      email: process.env.CENTRAL_USERNAME,
      password: process.env.CENTRAL_PASSWORD,
    };

    const response = await firstValueFrom(
      this.httpService.post(loginUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    return response.data.token;
  }

  private async fetchFormXml(refId: string, token: string): Promise<string> {
    const url = `${this.baseUrl}/v1/projects/${this.projectId}/forms/${refId}.xml`;
    const response = await firstValueFrom(
      this.httpService.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'text',
      }),
    );
    return response.data;
  }

private async convertXmlToQuestionsArray(xml: string, question_ids: string[] = []): Promise<any[]> {
  const parser = new xml2js.Parser({ explicitArray: false });
  const parsed = await parser.parseStringPromise(xml);

  const html = parsed['h:html'] || parsed['html'] || {};
  const body = html['h:body'] || html['body'] || {};
  const group = body['h:group'] || body['group'] || {};
  const groupArray = Array.isArray(group['group']) ? group['group'] : group['group'] ? [group['group']] : [];
  const label =
      group['h:label'] || group['label'] ||
      group['h:input']?.['h:label'] || group['input']?.['label'] || '';


  const extractQuestions = (grp: any) => {
    const questions: any[] = [];
    const select1s = grp['h:select1'] || grp['select1'] || [];
    const select1Array = Array.isArray(select1s) ? select1s : [select1s];

    for (const select1 of select1Array) {
      const question_id = select1?.['$']?.ref?.split('/')?.pop() || '';
      const question = {
        text: select1['h:label'] || select1['label'] || '',
        question_id,
        choices: (select1['h:item'] || select1['item'] || []).map((item: any) => ({
          text: item['h:label'] || item['label'] || '',
          id: item['h:value'] || item['value'] || '',
        })),
      };
      if (!question_ids.length || question_ids.includes(question_id)) {
        questions.push(question);
      }
    }

    const groupLabel =
      grp['h:label'] || grp['label'] ||
      grp['h:input']?.['h:label'] || grp['input']?.['label'] || '';

    return {
      group_label: label || "",
      group_text: groupLabel,
      questions,
    };
  };

  const allGroups = groupArray.length > 0
    ? groupArray.map(extractQuestions)
    : [extractQuestions(group)];

  return allGroups.filter(g => g.questions.length > 0); // only return groups that have questions
}


public async getLatestOdkAssessments(limit = 10): Promise<any[]> {
  // Step 1: Get latest assessment proofs with cycle_id
  const proofs = await this.prisma.assessment_proof.findMany({
    where: { cycle_id: { not: null } },
    orderBy: [
      { cycle_id: 'desc' },
      { created_at: 'desc' },
    ],
    take: limit,
    select: {
      cycle_id: true,
      mentor_id: true,
      student_id: true,
      udise: true,
      proof_url: true,
    },
  });

  if (!proofs || proofs.length === 0) {
    this.logger.warn('No assessment proofs found');
    return [];
  }

  this.logger.log(`Found ${proofs.length} assessment proofs ${JSON.stringify(proofs, null, 2)}`);

  const token = await this.getAuthToken();
  const results = [];

  for (const { cycle_id, mentor_id, student_id, udise, proof_url } of proofs) {
    this.logger.log(`Fetching latest submission timestamp for student_id: ${student_id}, mentor_id: ${mentor_id}, udise: ${udise}`);

    // Step 2: Get latest odk assessment to get submission_timestamp
    const latest = await this.prisma.assessments.findFirst({
      where: {
        mentor_id,
        student_id,
        udise,
        module: 'odk',
      },
      orderBy: {
        submission_timestamp: 'desc',
      },
      select: {
        submission_timestamp: true,
      },
    });

    if (!latest?.submission_timestamp) {
      this.logger.warn(`No latest submission found for student_id: ${student_id}`);
      continue;
    }

    const { submission_timestamp } = latest;

    // Step 3: Get all assessments with same submission_timestamp
    const assessments = await this.prisma.assessments.findMany({
      where: {
        mentor_id,
        student_id,
        udise,
        module: 'odk',
        submission_timestamp,
      },
      select: {
        workflow_ref_id: true,
        results_json: true,
      },
    });

    this.logger.log(`Found ${assessments.length} odk assessments for student_id: ${student_id} with timestamp ${submission_timestamp}`);

    const response_object = {
      cycle_id,
      mentor_id,
      student_id,
      udise,
      proof_url,
      assessments: [],
    }
    for (const { workflow_ref_id, results_json } of assessments) {
      const answers = Array.isArray(results_json) ? results_json : [];
      const question_ids = answers.map((a: any) => a.question);

      try {
        // Step 4: Fetch form XML and extract questions
        const xml = await this.fetchFormXml(workflow_ref_id, token);
        const question_group = await this.convertXmlToQuestionsArray(xml, question_ids);
        response_object.assessments.push({
          workflow_ref_id,
          question_group,
        });
      } catch (err) {
        this.logger.warn(`Error processing form ${workflow_ref_id}: ${err.message}`);
      }
    }
    results.push(response_object);
  }
  
  // write the response to a json file in the current directory
  fs.writeFileSync('./latest_odk_assessments.json', JSON.stringify(results, null, 2));

  return results;
}

}

