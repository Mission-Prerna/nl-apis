import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ValidationArguments } from 'class-validator/types/validation/ValidationArguments';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const prisma = new PrismaService();

@Injectable()
@ValidatorConstraint({ name: 'IsExist', async: true })
export class IsExist implements ValidatorConstraintInterface {
  async validate(value: string, validationArguments: ValidationArguments) {
    const model = validationArguments.constraints[0];
    const pathToProperty = validationArguments.constraints[1];
    // @ts-ignore
    if (typeof validationArguments.object[pathToProperty] === 'undefined' || validationArguments.object[pathToProperty] === null) {
      // if the field is null or empty, no need to run db query
      return false;
    }

    // @ts-ignore
    const entity = await prisma[model].count({
      where: {
        [pathToProperty ? pathToProperty : validationArguments.property]:
          pathToProperty ? value : value,
      },
    });
    return Boolean(entity);
  }

  defaultMessage(validationArguments: ValidationArguments): string {
    return `${validationArguments.property} must point to a valid record in the table.`;
  }
}

@ValidatorConstraint({ name: 'AreDifferentValue', async: true })
@Injectable()
export class AreDifferentValue implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): Promise<boolean> | boolean {
    // console.log(args)
    const [relatedPropertyName] = args.constraints;
    const realatedValue = (args.object as any)[relatedPropertyName];
    return value !== realatedValue;
  }
  defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints;
    return `${args.property} must have the different value as ${relatedPropertyName}`;
    // return messageService.CNF_PASSWORD;
  }
}

@Injectable()
@ValidatorConstraint({ name: 'ValidateGrades', async: true })
export class ValidateGrades implements ValidatorConstraintInterface {
  async validate(value: string, validationArguments: ValidationArguments) {
    if (!value) {
      return false;
    }
    let success = true;
    value.split(',').forEach((grade) => {
      if (!validationArguments.constraints.includes(grade.trim())) {
        success = false;
      }
    });

    return success;
  }

  defaultMessage(validationArguments: ValidationArguments): string {
    return `Allowed grades are ${validationArguments.constraints.join(', ')}.`;
  }
}