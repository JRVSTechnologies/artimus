const fs = require('fs');
const csv = require('csv-parser');

const results = [];
let count = 0;

fs.createReadStream('C:/Users/jossi/DeveloperWorkspace/artimus/data/Bills Signals f28dacda255045da9e5946021104905b_all.csv')
  .pipe(csv())
  .on('data', (data) => {
    if(count < 5) console.log(data);
    count++;
    results.push(data);
  })
  .on('end', () => {
    console.log(`Total rows: ${count}`);
    const columns = Object.keys(results[0]);
    columns.forEach(col => {
      let maxLen = 0;
      let hasString = false;
      results.forEach(row => {
        if (row[col]) {
          if (row[col].length > maxLen) maxLen = row[col].length;
          if (isNaN(Number(row[col]))) hasString = true;
        }
      });
      console.log(`${col}: max length ${maxLen}, isString: ${hasString}`);
    });
  });
