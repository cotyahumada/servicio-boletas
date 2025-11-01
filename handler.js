const AWS = require('aws-sdk');
const PDFDocument = require('pdfkit');

const s3 = new AWS.S3();

function crearBoleta(usuario, accion) {
  return new Promise((resolve, reject) => {
    let doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);


    generateHeader(doc);
    generateCustomerInformation(doc, usuario, accion);
    generateInvoiceTable(doc, accion);
    generateFooter(doc);

    doc.end();
  });
}

function generateHeader(doc) {
  doc
    .fontSize(20)
    .text("Properties Market", 50, 57)
    .fontSize(10)
    .text("Properties Market", 200, 50, { align: "right" })
    .text("Grupo 15 Arquisis", 200, 65, { align: "right" })
    .text("Santiago, Chile", 200, 80, { align: "right" })
    .moveDown();
}

function generateCustomerInformation(doc, usuario, accion) {
  doc
    .fillColor("#444444")
    .fontSize(20)
    .text("Boleta Electronica", 50, 160);

  generateHr(doc, 185);

  const customerInformationTop = 200;

  doc
    .fontSize(10)
    .text("Nombre:", 50, customerInformationTop)
    .font("Helvetica-Bold")
    .text(usuario.nombre, 150, customerInformationTop)
    .font("Helvetica")
    .text("Fecha:", 50, customerInformationTop + 15)
    .text(formatDate(new Date()), 150, customerInformationTop + 15)
    .text("Total pagado:", 50, customerInformationTop + 30)
    .text(
      accion.pagado,
      150,
      customerInformationTop + 30
    )
    .moveDown();

  generateHr(doc, 252);
}

function generateInvoiceTable(doc, accion) {
  let i;
  const invoiceTableTop = 330;

  doc.font("Helvetica-Bold");
  generateTableRow(
    doc,
    invoiceTableTop,
    "Propiedad",
    "",
    "",
    "Valor Reserva",
    "Valor Propiedad"
  );
  generateHr(doc, invoiceTableTop + 20);
  doc.font("Helvetica");

  
    
    const position = invoiceTableTop + 30;
    generateTableRow(
      doc,
      position,
      accion.nombre,
      "",
      "",
      formatCurrency(accion.pagado),
      formatCurrency(accion.precio)
    );

    generateHr(doc, position + 20);
  

  const subtotalPosition = invoiceTableTop + 60;
  generateTableRow(
    doc,
    subtotalPosition,
    "",
    "",
    "Subtotal",
    "",
    formatCurrency(accion.precio)
  );

  const paidToDatePosition = subtotalPosition + 20;
  generateTableRow(
    doc,
    paidToDatePosition,
    "",
    "",
    "Pagado hasta la fecha",
    "",
    formatCurrency(accion.pagado)
  );

  const duePosition = paidToDatePosition + 25;
  doc.font("Helvetica-Bold");
  generateTableRow(
    doc,
    duePosition,
    "",
    "",
    "Saldo pendiente",
    "",
    formatCurrency(accion.precio - accion.pagado)
  );
  doc.font("Helvetica");
}

function generateFooter(doc) {
  doc
    .fontSize(10)
    .text(
      "La reserva fue realizada correctamente. Gracias por su compra.",
      50,
      780,
      { align: "center", width: 500 }
    );
}

function generateTableRow(
  doc,
  y,
  propiedad,
  nada,
  nada2,
  valorReserva,
  precioTotal
) {
  doc
    .fontSize(10)
    .text(propiedad, 50, y)
    .text(nada, 150, y)
    .text(nada2, 280, y, { width: 90, align: "right" })
    .text(valorReserva, 370, y, { width: 90, align: "right" })
    .text(precioTotal, 0, y, { align: "right" });
}

function generateHr(doc, y) {
  doc
    .strokeColor("#aaaaaa")
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
}

function formatCurrency(n) {
  const amount = Math.round(Number(n) || 0);
  return '$' + amount.toLocaleString('es-CL', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function formatDate(date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return day + "/" + month + "/" + year;
}


exports.generarBoleta = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { grupo, usuario, accion } = body;

    if (!grupo || !usuario || !accion) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Faltan campos: grupo, usuario, accion' }) };
    }

    const pdfBuffer = await crearBoleta(usuario, accion );

    const bucket = process.env.BOLETAS_BUCKET;
    const safeUser = (usuario.id || usuario.email || 'user').replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeGroup = String(grupo).replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileKey = `boletas/${safeGroup}/${safeUser}-${Date.now()}.pdf`;

    await s3.putObject({
      Bucket: bucket,
      Key: fileKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf'
    }).promise();

    const url = s3.getSignedUrl('getObject', { Bucket: bucket, Key: fileKey, Expires: 600 });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Boleta generada', urlDescarga: url, bucket, key: fileKey })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Error generando boleta', error: err.message }) };
  }
};

// funcion para obtener el url de la boleta
exports.obtenerUrl = async (event) => {
  try {
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body || {};
    }
    
    const { fileKey } = body;

    if (!fileKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Falta el campo: fileKey' })
      };
    }

    const bucket = process.env.BOLETAS_BUCKET;
    if (!bucket) {
      throw new Error('BOLETAS_BUCKET no está configurado');
    }

    // Verificar que el archivo existe
    try {
      await s3.headObject({ Bucket: bucket, Key: fileKey }).promise();
    } catch (err) {
      if (err.code === 'NotFound') {
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'El archivo no existe' })
        };
      }
      throw err;
    }

    // Generar nueva URL pre-firmada
    const url = s3.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: fileKey,
      Expires: 3600  // 1 hora
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'URL regenerada exitosamente',
        urlDescarga: url,
        key: fileKey
      })
    };
  } catch (err) {
    console.error('Error regenerando URL:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error regenerando URL',
        error: err.message
      })
    };
  }
};