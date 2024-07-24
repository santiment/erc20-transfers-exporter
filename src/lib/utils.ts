export function getBoolEnvVariable(name: string, defaultValue?: boolean) {
  const value = process.env[name]
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw Error(`Value ${name} need to be set`);
    }
    else {
      return defaultValue;
    }
  }

  const lowerCasedValue = value.trim().toLowerCase();
  return lowerCasedValue === 'true' || lowerCasedValue === '1';
}

export const getLazyBoolEnvVariable = (name: string) => {
  return () => getBoolEnvVariable(name);
};

export function getIntEnvVariable(name: string, defaultValue: number | undefined) {
  const value = process.env[name]
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw Error(`Value ${name} need to be set`);
    }
    else {
      return defaultValue;
    }
  }

  return parseInt(value.trim().toLowerCase());
}

export function assertIsDefined<T>(value: any, errorMsg: string): asserts value is NonNullable<T> {
  if (value === undefined || value === null) {
    throw Error(errorMsg);
  }
}

export type ModeToKafkaTopic = {
  [topicName: string]: string;
}

export function parseKafkaTopicToObject(kafkaTopic: string): ModeToKafkaTopic {
  const keyValuePairs = kafkaTopic.split(',');

  const result: ModeToKafkaTopic = keyValuePairs.reduce((acc, pair) => {
    const [key, value] = pair.split(':');
    if (key && value) {
      acc[key.trim()] = value;
    }
    else {
      throw new Error(`key-value pair format is unexpected in KAFKA_TOPIC`);
    }
    return acc;
  }, {} as ModeToKafkaTopic);

  if (Object.keys(result).length < 1) {
    throw new Error(`Can not construct multi mode from ${kafkaTopic}`)
  }

  return result;
}
