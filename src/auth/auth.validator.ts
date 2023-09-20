import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
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
    if (typeof validationArguments.object[pathToProperty] !== 'undefined') {
      // if the field is null or empty, no need to run db query
      return false;
    }

    // @ts-ignore
    const entity = await prisma[model].findFirst({
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
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)[relatedPropertyName];
    return value !== relatedValue;
  }
  defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints;
    return `${args.property} must have the different value as ${relatedPropertyName}`;
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

@ValidatorConstraint({ name: 'RequiredIf', async: true })
@Injectable()
export class RequiredIf implements ValidatorConstraintInterface {
  private msg: null | string = null;
  validate(value: any, args: ValidationArguments): Promise<boolean> | boolean {
    const otherField = args.constraints[0]; // we'll validate if this field is present then the current field must be present & EQUAL TO (or) with IN second field i.e. element or array
    let otherFieldValues = args.constraints[1];
    if (!(otherFieldValues instanceof Array)) {
      otherFieldValues = [otherFieldValues];
    }

    // @ts-ignore
    if (!args.object[otherField]) {
      this.msg = `'${otherField}' must be present and not empty.`;
      return false;
    } else {
      let isMatched = false;
      for (const otherFieldValue of otherFieldValues) {
        // @ts-ignore
        if (otherFieldValues.includes(args.object[otherField])) {
          isMatched = true;
        }
      }
      if (isMatched && !value) {
        this.msg = `${args.property} is required if '${otherField}' is in [${otherFieldValues}].`;
        return false;
      }
    }
    return true;
  }
  defaultMessage(args: ValidationArguments): string {
    if (this.msg) {
      return this.msg;
    }
    const [relatedPropertyName] = args.constraints;
    return `${args.property} must have the different value as ${relatedPropertyName}`;
  }
}

/*
  Inspired from https://laravel.com/docs/10.x/validation#rule-required-without-all
  The field under validation must be present and not empty only when all of the other specified fields are empty or not present.
 */
@ValidatorConstraint({ name: 'RequiredWithoutAll', async: true })
@Injectable()
export class RequiredWithoutAll implements ValidatorConstraintInterface {
  private msg: null | string = null;
  validate(value: any, args: ValidationArguments): Promise<boolean> | boolean {
    let allOthersAreEmpty = true;
    const otherFields = args.constraints;
    for (const field of otherFields) {
      // @ts-ignore
      if (args.object.hasOwnProperty(field) && args.object[field]) {
        allOthersAreEmpty = false;
        break;
      }
    }
    return allOthersAreEmpty;
  }
  defaultMessage(args: ValidationArguments): string {
    if (this.msg) {
      return this.msg;
    }
    return `${args.property} must be present & not empty when non of the fields ${args.constraints.join(', ')} are empty or not present.`;
  }
}