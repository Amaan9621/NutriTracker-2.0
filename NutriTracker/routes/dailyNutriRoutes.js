import express from 'express';
import sql from 'mssql';
import { dbConfig } from '../config/database.js'; // Importér databasekonfigurationen
import e from 'express';


const app = express.Router();
app.get('/api/daily-nutri/hourly/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const pool = await sql.connect(dbConfig);

    // Hent kalorie- og vandindtag for de seneste 24 timer
    const mealQuery = `
      SELECT DATEPART(hour, t.consumptionDate) AS hour, 
      SUM(t.weight * m.kcal / 100) AS mealKcal
      FROM tracker t
      JOIN meals m ON t.mealId = m.mealId
      WHERE t.userId = @userId AND t.consumptionDate >= DATEADD(hour, -24, GETDATE())
      GROUP BY DATEPART(hour, t.consumptionDate)
    `;

    const ingredientQuery = `
    SELECT DATEPART(hour, t.consumptionDate) AS hour, 
       SUM(t.weight * i.kcal / 100) AS ingredientKcal
    FROM tracker t
    JOIN meal_ingredients mi ON t.mealIngredientId = mi.mealIngredientId
    JOIN ingredients i ON mi.ingredientId = i.ingredientId
    WHERE t.userId = @userId AND t.consumptionDate >= DATEADD(hour, -24, GETDATE())
    GROUP BY DATEPART(hour, t.consumptionDate)
`;
    const waterIntakeQuery = `
      SELECT DATEPART(hour, dateAndTimeOfDrinking) AS hour, SUM(amountOfWater) AS totalWater
      FROM waterRegistration
      WHERE userId = @userId AND dateAndTimeOfDrinking >= DATEADD(hour, -24, GETDATE())
      GROUP BY DATEPART(hour, dateAndTimeOfDrinking)
    `;

    // Hent aktivitetsforbrænding
    const activityQuery = `
      SELECT DATEPART(hour, activityDate) AS hour, SUM(caloriesBurned) AS totalCaloriesBurned
      FROM activities
      WHERE userId = @userId AND activityDate >= DATEADD(hour, -24, GETDATE())
      GROUP BY DATEPART(hour, activityDate)
    `;

    // Basalforbrænding (BMR) for bruger fordelt på 24 timer
    const bmrQuery = `SELECT bmr FROM profiles WHERE userId = @userId`;

    // Udfør SQL-forespørgsler
    const foodIntake = await pool.request().input('userId', sql.Int, userId).query(mealQuery);
    const ingredientIntake = await pool.request().input('userId', sql.Int, userId).query(ingredientQuery);
    const waterIntake = await pool.request().input('userId', sql.Int, userId).query(waterIntakeQuery);
    const activityBurn = await pool.request().input('userId', sql.Int, userId).query(activityQuery);
    const bmr = await pool.request().input('userId', sql.Int, userId).query(bmrQuery);

    

    // Saml og beregn data for hver time
    const hourlyData = [];
    const bmrPerHour = bmr.recordset[0].bmr / 24 * 238.846;

    for (let hour = 0; hour < 24; hour++) {
      const meals = foodIntake.recordset.find((row) => row.hour === hour)?.mealKcal || 0;
      const ingredient = ingredientIntake.recordset.find((row) => row.hour === hour)?.ingredientKcal || 0;
      const food = meals + ingredient;
      const water = waterIntake.recordset.find((row) => row.hour === hour)?.totalWater || 0;
      const activity = activityBurn.recordset.find((row) => row.hour === hour)?.totalCaloriesBurned || 0;
      const totalBurn = bmrPerHour + activity;
      const surplusDeficit = food - totalBurn;

      hourlyData.push({
        hour,
        energy: food,
        water: (water / 1000).toFixed(2),
        calorieBurn: totalBurn.toFixed(2),
        surplusDeficit: surplusDeficit.toFixed(2),
      });
    }

    res.json(hourlyData);
  } catch (error) {
    console.error('Fejl ved hentning af timebaseret data:', error);
    res.status(500).json({ message: 'Fejl ved hentning af timebaseret data', error: error.message });
  }
});



app.get('/api/daily-nutri/monthly/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const pool = await sql.connect(dbConfig);

    // Hent kalorie- og vandindtag for de seneste 30 dage
    const mealQuery = `
    SELECT CAST(t.consumptionDate AS DATE) AS date, 
           SUM(t.weight * m.kcal / 100) AS mealKcal
    FROM tracker t
    JOIN meals m ON t.mealId = m.mealId
    WHERE t.userId = @userId AND t.consumptionDate >= DATEADD(day, -30, GETDATE())
    GROUP BY CAST(t.consumptionDate AS DATE)
`;
const ingredientQuery = `
    SELECT CAST(t.consumptionDate AS DATE) AS date, 
           SUM(t.weight * i.kcal / 100) AS ingredientKcal
    FROM tracker t
    JOIN meal_ingredients mi ON t.mealIngredientId = mi.mealIngredientId
    JOIN ingredients i ON mi.ingredientId = i.ingredientId
    WHERE t.userId = @userId AND t.consumptionDate >= DATEADD(day, -30, GETDATE())
    GROUP BY CAST(t.consumptionDate AS DATE)
`;

    const waterIntakeQuery = `
      SELECT CAST(dateAndTimeOfDrinking AS DATE) AS date, SUM(amountOfWater) AS totalWater
      FROM waterRegistration
      WHERE userId = @userId AND dateAndTimeOfDrinking >= DATEADD(day, -30, GETDATE())
      GROUP BY CAST(dateAndTimeOfDrinking AS DATE)
    `;

    // Hent aktivitetsforbrænding
    const activityQuery = `
      SELECT CONVERT(date, activityDate) AS date, SUM(caloriesBurned) AS totalCaloriesBurned
      FROM activities
      WHERE userId = @userId AND activityDate >= DATEADD(day, -30, GETDATE())
      GROUP BY CONVERT(date, activityDate)
    `;

    // Basalforbrænding (BMR) for bruger fordelt på 30 dage
    const bmrQuery = `SELECT bmr FROM profiles WHERE userId = @userId`;

    // Udfør SQL-forespørgsler
    const foodIntake = await pool.request().input('userId', sql.Int, userId).query(mealQuery);
    const ingredientIntake = await pool.request().input('userId', sql.Int, userId).query(ingredientQuery);
    const waterIntake = await pool.request().input('userId', sql.Int, userId).query(waterIntakeQuery);
    const activityBurn = await pool.request().input('userId', sql.Int, userId).query(activityQuery);
    const bmr = await pool.request().input('userId', sql.Int, userId).query(bmrQuery);
    console.log(foodIntake.recordset, waterIntake.recordset, activityBurn.recordset, bmr.recordset);

    // Saml og beregn data for hver dag
    const dailyData = [];
    const bmrMJ = bmr.recordset[0].bmr;
    const bmrPerDay = bmrMJ * 238.846;

    // Gå igennem hver af de sidste 30 dage
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      // Find data for den aktuelle dato i resultaterne
      const meals = foodIntake.recordset.find((entry) => entry.date.toISOString().substring(0, 10) === dateString)?.mealKcal || 0;
      const ingredient = ingredientIntake.recordset.find((entry) => entry.date.toISOString().substring(0, 10) === dateString)?.ingredientKcal || 0;
      const food = meals + ingredient;
      const water = waterIntake.recordset.find((entry) => entry.date.toISOString().substring(0, 10) === dateString)?.totalWater || 0;
      const activity = activityBurn.recordset.find((entry) => entry.date.toISOString().substring(0, 10) === dateString)?.totalCaloriesBurned || 0;
      const totalBurn = bmrPerDay + activity;

      // Tilføj data til det daglige array
      dailyData.push({
        date: dateString,
        energy: food,
        water: (water / 1000).toFixed(2), // Konverter til liter
        calorieBurn: totalBurn.toFixed(2),
        surplusDeficit: (food - totalBurn).toFixed(2),
      });
    }

    res.json(dailyData);
  } catch (error) {
    console.error('Fejl ved hentning af dagsbaseret data:', error);
    res.status(500).json({ message: 'Fejl ved hentning af dagsbaseret data', error: error.message });
  }
});

  export default app;
