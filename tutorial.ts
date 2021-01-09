/*
//
// Mezza's reference page for understanding typescript
//
*/

// Interfaces are 'objects'. They work similarly to javascript objects but can be explicitly assigned to different variables.
interface car {
    "model": string,
    "year": number,
    "working": boolean,
}

// Interfaces (objects) can be assigned to different variable scopes. (internal, global, constant, etc.)
// here, we create a custom subaru outback object from the interface 'car'.
const subaru_outback: car = {
    model: 'Subaru XV',
    year: 2015,
    working: true,
};

// This class will be used to manage our 'car'. 
class license {
    "name": string;
    "code": number;
    "car": car; // We can explicitly assign the interface 'car' as a data type

    // When we define the class, we set values for our license, such as name, code, etc.
    // - parameter: data.
    constructor(name: string, code: number, car: car) {
        this.name = name;
        this.code = code;
        this.car = car;
    }

    public allowedToDrive(queried_car: car): boolean {
        return queried_car === this.car;
    }
}

// Let's create a new license for ben.
// - Ben's license only allows him to drive a subaru outback. Let's use our interface we created before;
const ben_license = new license("Ben Benson", 12345, subaru_outback);

if (ben_license.allowedToDrive(subaru_outback)) {
    console.log('Ben is allowed to drive an outback!');
}

else {
    console.log('Ben cannot drive an outback. :(');
}

