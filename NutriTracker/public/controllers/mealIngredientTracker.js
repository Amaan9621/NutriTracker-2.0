//Mealtracker til ingredienser


const ingredient = document.getElementById('ingredient');
let ingredientId;
//Kode til at søge efter ingredienser
function populateIngredientList(results) {
  const ingredientList = document.getElementById('ingredient-list');
  // fjerner tidligere resultater
  ingredientList.innerHTML = ''

  for (const result of results) {
    const option = document.createElement('option')
    option.value = result.foodName
    option.text = result.foodName
    option.id = result.foodID;
    ingredientList.appendChild(option)
  }

  document.getElementById('ingredient').addEventListener('input', function(event) {
    const selectedOption = document.querySelector(`#ingredient-list option[value="${event.target.value}"]`);
    if (selectedOption) {
      ingredientId = selectedOption.id;
      console.log(ingredientId);
      document.getElementById('foodID').value = ingredientId;
    }
  });
  
}

async function fetchFoodItems(input) {
  const searchString = input.charAt(0).toUpperCase() + input.slice(1);
  const url = `https://nutrimonapi.azurewebsites.net/api/FoodItems/BySearch/${searchString}`;

  try {
    let response = await fetch(url, {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        'X-API-Key': apiKey,
      },
    });

    if (response.ok) {
      let result = await response.json();
      return result
    } else {
      console.error('Failed to fetch data. Status:', response.status);
      return null;
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

ingredient.addEventListener('keypress', async (event) => {
  const results = await fetchFoodItems(event.target.value)
  if (!results) {
    console.log('No results')
    return
  }

  populateIngredientList(results)


})
const ProteinKey = 1110; // SortKey for protein
const kcalKey = 1030; // SortKey for kcal
const fatKey = 1310; // SortKey for fedt
const fiberKey = 1240; // SortKey for fiber


async function fetchNutrientValue(foodID, sortKey, nutrientName) {
  const url = `https://nutrimonapi.azurewebsites.net/api/FoodCompSpecs/ByItem/${foodID}/BySortKey/${sortKey}`;

  try {
      let response = await fetch(url, {
          method: 'GET',
          headers: {
              'content-type': 'application/json',
              'X-API-Key': apiKey,
          },
      });

      if (response.ok) {
          let result = await response.json();
          if (result.length > 0) {
              return result[0].resVal;
          } else {
              console.log(`${nutrientName} not found for foodID: ${foodID}`);
              return null;
          }
      } else {
          console.error('Failed to fetch nutrient value. Status:', response.status);
          return null;
      }
  } catch (error) {
      console.error('Error fetching nutrient value:', error);
      return null;
  }
}


async function fetchAndValidateNutrient(foodID, sortKey, nutrientName) {
  const value = await fetchNutrientValue(foodID, sortKey, nutrientName);
  const numberValue = parseFloat(value);

  if (!isNaN(numberValue)) {
      return numberValue;
  } else {
      console.error(`Value for ${nutrientName} is not a number:`, value);
      return 0;
  }
}

async function addIngredient(ingredientName) {
  const foodID = document.getElementById('foodID').value;
  const kcal = await fetchAndValidateNutrient(foodID, kcalKey, 'Energy');
  const protein = await fetchAndValidateNutrient(foodID, ProteinKey, 'Protein');
  const fat = await fetchAndValidateNutrient(foodID, fatKey, 'Fat');
  const fiber = await fetchAndValidateNutrient(foodID, fiberKey, 'Fiber');
  try {
    const response = await fetch('http://localhost:3000/api/mealingredienttracker/meal-tracker/ingredient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredient: ingredientName,
        kcal: kcal, 
        protein: protein,
        fat: fat,
        fiber: fiber
      })
    });

    if (!response.ok) {
      throw new Error('Fejl ved tilføjelse af ingrediens');
    }

    const data = await response.json(); 
    return data; 

  } catch (error) {
    console.error('Fejl ved tilføjelse af ingrediens:', error);
    throw error;
  }}

  async function addMealIngredient(ingredientId, weight) {
    const userId = JSON.parse(localStorage.getItem('user')).userId;
  
    try {
    const response = await fetch('http://localhost:3000/api/mealingredienttracker/meal-tracker/meal-ingredients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredientId: ingredientId,
        weightOfIngredient: weight,
        userId: userId
      })
    });

    if (!response.ok) {
      throw new Error('Fejl ved tilføjelse af ingrediens til måltidsingredienser');
    }

    const data = await response.json(); 
    return data; 

  } catch (error) {
    console.error('Fejl ved tilføjelse af ingrediens til måltidsingredienser:', error);
    throw error;
  }}



  async function trackIngredient(mealIngredientId, weight, location) {

    try {
    const response = await fetch('http://localhost:3000/api/mealingredienttracker/meal-tracker/track-ingredient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mealIngredientId: mealIngredientId,
        weight: weight,
        userId: JSON.parse(localStorage.getItem('user'))?.userId,
        consumptionDate: new Date().toISOString().slice(0, 16).replace('T', ' '),
        location: location
      })
    });
    
    if (!response.ok) {
      throw new Error('Fejl ved tilføjelse af ingrediens til måltidsingredienser');
    }
  } catch (error) {
    console.error('Fejl ved tilføjelse af ingrediens til måltidsingredienser:', error);
    throw error;
  }}


  async function getLocation() {
    return new Promise((resolve, reject) => {
      // Hent brugerens geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = `Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}`;
            resolve(location);
          },
          (error) => {
            console.warn('Geolocation ikke tilgængelig:', error.message);
            resolve('Unknown');
          }
        );
      } else {
        resolve('Unknown');
      }
    });
  }



  async function registerIngredient() {
    const ingredientName = document.getElementById('ingredient').value;
    const weight = document.getElementById('ingredient-weight').value;
  
    try {
      const response = await addIngredient(ingredientName);
      const ingredientId = response.ingredientId;
      const response1 = await addMealIngredient(ingredientId, weight);
      const mealIngredientId = response1.mealIngredientId;
      
      // Hent brugerens position
      const location = await getLocation();
    
      await trackIngredient(mealIngredientId, weight, location);
    

      alert('Ingrediens tilføjet med succes til begge tabeller');
      updateIngredientLogDisplay()
  
    } catch (error) {
      console.error('Fejl:', error);
      alert('Der opstod en fejl under registrering af ingrediens');
    }
  }
  
  document.getElementById('ingredient-registration-form').addEventListener('submit', function (event) {
    event.preventDefault();
    registerIngredient();
  });