"use strict";

const AWS = require("aws-sdk");
const uuid = require("uuid");

const dynamodbOfflineOptions = {
  region: "localhost",
  endpoint: "http://localhost:8000",
};

const isOffline = () => process.env.IS_OFFLINE;

const dynamodb = isOffline()
  ? new AWS.DynamoDB(dynamodbOfflineOptions)
  : new AWS.DynamoDB({ apiVersion: "2012-08-10" });

const params = {
  TableName: processs.env.PACIENTES_TABLE,
};

module.exports.listarPacientes = async (event) => {
  try {
    console.log(event);

    const queryParams = {
      limit: 5,
      ...event.queryStringParameters,
    };

    const { limit, next } = queryParams;

    let localParams = {
      ...params,
      Limit: limit,
    };

    if (next) {
      localParams.ExclusiveStartKey = {
        paciente_id: { S: next },
      };
    }

    const data = await dynamodb.scan(localParams).promise();

    let nextToken =
      data.LastEvaluatedKey !== undefined
        ? data.LastEvaluatedKey.paciente_id
        : null;

    const result = {
      items: data.Items,
      next_token: nextToken,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.log("Error", err);
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : "Exception",
        message: err.message ? err.message : "Unknow error",
      }),
    };
  }
};

module.exports.obterPaciente = async (event) => {
  const { pacienteId } = event.pathParameters;

  const data = await dynamodb
    .getItem({
      ...params,
      Key: {
        paciente_id: { S: pacienteId },
      },
    })
    .promise();

  if (!data.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify(
        {
          error: "Paciente não encontrado",
        },
        null,
        2
      ),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(data.Item),
  };
};

module.exports.cadastrarPaciente = async (event) => {
  try {
    const timestamp = new Date().getTime().toString();
    const dados = JSON.parse(event.body);
    const { nome, telefone, email, data_nascimento } = dados;

    const paciente = {
      ...params,
      Item: {
        paciente_id: { S: uuid.v4() },
        nome: { S: nome },
        telefone: { S: telefone },
        email: { S: email },
        data_nascimento: { S: data_nascimento },
        status: { BOOL: true },
        criadoEm: { N: timestamp },
        atualizadoEm: { N: timestamp },
      },
    };

    await dynamodb.putItem(paciente).promise();

    return {
      statusCode: 200,
    };
  } catch (err) {
    console.log("Error", err);
    return {
      statusCode: err.statusCode ? err.statusCode : 500,
      body: JSON.stringify({
        error: err.name ? err.name : "Exception",
        message: err.message ? err.message : "Unknow error",
      }),
    };
  }
};

module.exports.atualizarPaciente = async (event) => {
  const { pacienteId } = event.pathParameters;

  try {
    const timestamp = new Date().getTime().toString();

    const dados = JSON.parse(event.body);
    const { nome, telefone, email, data_nascimento } = dados;

    const data = {
      ...params,
      Key: {
        paciente_id: { S: pacienteId },
      },
      UpdateExpression: `SET nome = :nome, data_nascimento = :dt, email = :email, telefone = :telefone, atualizadoEm = :atualizadoEm`,
      ConditionExpression: "attribute_exists(paciente_id)",
      ExpressionAttributeValues: {
        ":nome": { S: nome },
        ":dt": { S: data_nascimento },
        ":email": { S: email },
        ":telefone": { S: telefone },
        ":atualizadoEm": { N: timestamp },
      },
    };

    await dynamodb.updateItem(data).promise();

    return {
      statusCode: 204,
    };
  } catch (err) {
    console.log("Error", err);

    let error = err.name ? err.name : "Exception";
    let message = err.message ? err.message : "Unknow error";
    let statusCode = err.statusCode ? err.statusCode : 500;

    if (error === "ConditionalCheckFailedException") {
      error = "Paciente não existe";
      message = `Recouso com ID ${pacienteId} não existe e não pode ser atualizado`;
      statusCode = 404;
    }

    return {
      statusCode,
      body: JSON.stringify({
        error,
        message,
      }),
    };
  }
};

module.exports.excluirPaciente = async (event) => {
  const { pacienteId } = event.pathParameters;

  try {
    await dynamodb
      .deleteItem({
        ...params,
        Key: {
          paciente_id: { S: pacienteId },
        },
        // Lança um erro caso a conditional não funcione
        ConditionExpression: "attribute_exists(paciente_id)",
      })
      .promise();

    return {
      statusCode: 204,
    };
  } catch (err) {
    let error = err.name ? err.name : "Exception";
    let message = err.message ? err.message : "Unknow error";
    let statusCode = err.statusCode ? err.statusCode : 500;

    if (error === "ConditionalCheckFailedException") {
      error = "Paciente não existe";
      message = `Recouso com ID ${pacienteId} não existe e não pode ser atualizado`;
      statusCode = 404;
    }

    return {
      statusCode,
      body: JSON.stringify({
        error,
        message,
      }),
    };
  }
};
